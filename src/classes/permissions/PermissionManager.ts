import Permission from "./Permission.js";
import db from "../../db.js";
import {Types} from "mongoose";

export default class PermissionManager {
    private static _instance: PermissionManager;

    public static permissions: { [key: string]: { permission: Permission, description: string } } = {};

    constructor() {
        // Only allow one instance of this class to exist
        if (PermissionManager._instance) {
            return PermissionManager._instance;
        }
        PermissionManager._instance = this;

        this.registerPermissions();
    }

    private registerPermissions() {
        console.time("PermissionManager.registerPermissions");
        // Register all permissions
        const r = this.registerPermission.bind(this);
        r("READ_CHANNEL", "Read channel information, receive new messages.");
        r("WRITE_MESSAGE", "Send, delete and edit own message in a channel.", ["READ_CHANNEL"]);
        r("READ_CHANNEL_HISTORY", "Read message history", ["READ_CHANNEL"]);
        r("WRITE_ATTACHMENT", "Send attachments", ["WRITE_MESSAGE"]);
        r("DELETE_OTHER_MESSAGE", "Delete other user's messages", ["READ_CHANNEL"]);
        r("MESSAGE_ADMIN", "Manage messages. Grants all message permissions.", ["WRITE_MESSAGE", "WRITE_ATTACHMENT", "DELETE_OTHER_MESSAGE"]);

        r("EDIT_CHANNEL_DESCRIPTION", "Edit channel description", ["READ_CHANNEL"]);
        r("EDIT_CHANNEL_NAME", "Edit channel name", ["READ_CHANNEL"]);
        r("EDIT_CHANNEL", "Edit channel information", ["EDIT_CHANNEL_DESCRIPTION", "EDIT_CHANNEL_NAME"]);
        r("DELETE_CHANNEL", "Delete a channel", ["EDIT_CHANNEL"]);
        r("CREATE_CHANNEL", "Create channels", [], ["quark"]);
        r("CHANNEL_MANAGER", "Manage channels. Grants all channel management permissions.", ["EDIT_CHANNEL", "DELETE_CHANNEL", "CREATE_CHANNEL"]);
        r("CHANNEL_ADMIN", "Manage channels and messages. Grants Channel Manager and Message Admin permissions.", ["CHANNEL_MANAGER", "MESSAGE_ADMIN"]);

        r("EDIT_QUARK_ICON", "Change quark icon", [], ["quark"]);
        r("EDIT_QUARK_NAME", "Change quark name", [], ["quark"]);
        r("EDIT_QUARK_DESCRIPTION", "Change quark description", [], ["quark"]);
        r("EDIT_QUARK_INVITE", "Change quark invite", [], ["quark"]);
        r("EDIT_QUARK_ROLES", "Change quark roles", [], ["quark"]);
        r("ASSIGN_ROLE", "Assign roles to users", [], ["quark"]);
        r("NICKNAME_OTHER", "Change other people's nicknames", [], ["quark"]);
        r("MANAGE_QUARK", "Manage quark. Grants all quark management permissions.", ["EDIT_QUARK_ICON", "EDIT_QUARK_NAME", "EDIT_QUARK_DESCRIPTION", "EDIT_QUARK_INVITE", "EDIT_QUARK_ROLES"], ["quark"]);
        r("ADMIN", "General admin. Grants all admin permissions.", ["MANAGE_QUARK", "CHANNEL_ADMIN", "ASSIGN_ROLE", "NICKNAME_OTHER"], ["quark"]);
        r("OWNER", "Owner of the quark. Grants all permissions.", ["ADMIN"], ["quark"]);
        console.timeEnd("PermissionManager.registerPermissions");
    }

    private registerPermission(permissionName: PermissionType, description: string, childrenNames: PermissionType[] = [], scopes: ("quark" | "channel")[] = ["quark", "channel"]) {
        let children = childrenNames.map(child => {
            let permission = PermissionManager.permissions[child].permission;
            if (!permission) throw new Error(`Child permission ${child} for parent ${permissionName} does not exist. Double check registration order.`);
            return permission;
        });
        console.debug(`Registering ${permissionName} with scopes ${scopes} and children ${childrenNames.join(", ")}`);
        PermissionManager.permissions[permissionName] = {permission: new Permission(permissionName, scopes, children), description: description};
    }

    /**
     *
     * @param permission
     * @param userId
     * @param scope
     */
    public static async isPermitted(permission: PermissionType, userId, scope: {scopeType: ("quark"|"channel"), scopeId, quarkId?}) : Promise<boolean> {
        if (!PermissionManager.permissions[permission]) throw new Error(`Permission ${permission} is not registered.`);
        let permissionAssignments = await this.getAssignments(userId, scope);
        return permissionAssignments.some(perm => this.permissions[perm.permission].permission.grants(permission));

    }

    static async getAssignments(userId, scope: {scopeType: ("quark"|"channel"), scopeId, quarkId?}) {
        let assignments : any[] = [];
        // If scope is a channel, and no quark id was provided, get the quark id from the channel
        let Quarks = db.getQuarks();
        let scopeId = scope.scopeId;
        let quarkId = scope.scopeId;
        let quark
        if (scope.scopeType === "channel" && !scope.quarkId) {
            quark = await Quarks.findOne({channels: new Types.ObjectId(scope.scopeId)});
            if (!quark) throw new Error(`Channel ${scope.scopeId} does not exist.`);
            quarkId = quark._id;
        } else if (scope.scopeType === "channel") {
            quarkId = scope.quarkId;
        }
        if (!quark) {
            quark = await Quarks.findOne({_id: scope.quarkId});
        }
        if (!quark) throw new Error(`Quark ${scope.quarkId} does not exist.`);
        if (quark.owners.includes(String(userId))) {
            assignments.push({
                _id: new Types.ObjectId("6468bf123d2862c91e9aa25a"), // Randomly generated
                role: {
                    _id: new Types.ObjectId("6468c10b39a150bb80c13bd8"), // Randomly generated
                    name: "Owner",
                    quark: new Types.ObjectId(quarkId),
                    description: "This is a fake owner role",
                    createdBy: new Types.ObjectId("6468c158f31b7a04727771b3"), // Randomly generated
                    priority: Infinity
                },
                scopeType: "quark",
                scopeId: new Types.ObjectId(quarkId),
                permission: "OWNER",
                type: "allow"
            })
        }

        // Find all permission assignments that affect the user in this scope, both channel and quark level
        let PermissionAssignments = db.getPermissionAssignments();
        let RoleAssignments = db.getRoleAssignments();
        const permissionAssignments = await PermissionAssignments.find({
            $or: [
                {
                    "role": { $in: await RoleAssignments.find({ user: userId, quark: quarkId }).distinct("role") },
                    "scopeType": "quark",
                    "scopeId": quarkId
                },
                {
                    "role": { $in: await RoleAssignments.find({ user: userId, quark: quarkId }).distinct("role") },
                    "scopeType": "channel",
                    "scopeId": scopeId
                }
            ]
        }).populate('role');

        assignments = [...assignments, ...permissionAssignments];
        return assignments
    }
}