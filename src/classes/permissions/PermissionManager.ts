import Permission from "./Permission.js";
import db from "../../db.js";
import {isValidObjectId, Types} from "mongoose";
import {
    ConstantID_DenyAssignment, ConstantID_DenyRole,
    ConstantID_OwnerAssignment,
    ConstantID_OwnerRole,
    ConstantID_SystemUser
} from "../../util/ConstantID.js";

export default class PermissionManager {
    private static _instance: PermissionManager;

    public static permissions: { [key: string]: { permission: Permission, description: string, default: ("allow"|"deny") } } = {};

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
        r("READ_CHANNEL", "allow", "Read channel information, receive new messages.");
        r("WRITE_MESSAGE", "allow", "Send, delete and edit own message in a channel.", ["READ_CHANNEL"]);
        r("READ_CHANNEL_HISTORY", "allow", "Read message history", ["READ_CHANNEL"]);
        r("WRITE_ATTACHMENT", "allow", "Send attachments", ["WRITE_MESSAGE"]);
        r("USE_EXTERNAL_EMOJI", "allow", "Use emotes from other quarks", ["WRITE_MESSAGE"]);
        r("DELETE_OTHER_MESSAGE", "deny", "Delete other user's messages", ["READ_CHANNEL"]);
        r("MESSAGE_ADMIN", "deny", "Manage messages. Grants all message permissions.", ["WRITE_MESSAGE", "WRITE_ATTACHMENT", "DELETE_OTHER_MESSAGE"]);

        r("EDIT_CHANNEL_DESCRIPTION", "deny", "Edit channel description", ["READ_CHANNEL"]);
        r("EDIT_CHANNEL_NAME", "deny", "Edit channel name", ["READ_CHANNEL"]);
        r("EDIT_CHANNEL", "deny", "Edit channel information", ["EDIT_CHANNEL_DESCRIPTION", "EDIT_CHANNEL_NAME"]);
        r("DELETE_CHANNEL", "deny", "Delete a channel", ["EDIT_CHANNEL"]);
        r("CREATE_CHANNEL", "deny", "Create channels", [], ["quark"]);
        r("CHANNEL_MANAGER", "deny", "Manage channels. Grants all channel management permissions.", ["EDIT_CHANNEL", "DELETE_CHANNEL", "CREATE_CHANNEL"]);
        r("CHANNEL_ADMIN", "deny", "Manage channels and messages. Grants Channel Manager and Message Admin permissions.", ["CHANNEL_MANAGER", "MESSAGE_ADMIN"]);

        r("CREATE_EMOTE", "deny", "Add new emotes", [], ["quark"]);
        r("EDIT_EMOTE", "deny", "Edit emotes", [], ["quark"]);
        r("DELETE_EMOTE", "deny", "Remove emotes", [], ["quark"]);
        r("MANAGE_EMOTE", "deny", "All emote permissions", ["CREATE_EMOTE", "EDIT_EMOTE", "DELETE_EMOTE"], ["quark"]);


        r("EDIT_QUARK_ICON", "deny", "Change quark icon", [], ["quark"]);
        r("EDIT_QUARK_NAME", "deny", "Change quark name", [], ["quark"]);
        r("EDIT_QUARK_DESCRIPTION", "deny", "Change quark description", [], ["quark"]);
        r("EDIT_QUARK_INVITE", "deny", "Change quark invite", [], ["quark"]);
        r("EDIT_QUARK_ROLES", "deny", "Change quark roles", [], ["quark"]);
        r("ASSIGN_ROLE", "deny", "Assign roles to users", [], ["quark"]);
        //r("NICKNAME_OTHER", "deny", "Change other people's nicknames", [], ["quark"]);
        r("MANAGE_QUARK", "deny", "Manage quark. Grants all quark management permissions.", ["EDIT_QUARK_ICON", "EDIT_QUARK_NAME", "EDIT_QUARK_DESCRIPTION", "EDIT_QUARK_INVITE", "EDIT_QUARK_ROLES"], ["quark"]);
        r("ADMIN", "deny", "General admin. Grants all admin permissions.", ["MANAGE_QUARK", "CHANNEL_ADMIN", "ASSIGN_ROLE"/*, "NICKNAME_OTHER"*/], ["quark"]);
        r("OWNER", "deny", "Owner of the quark. Grants all permissions.", ["ADMIN"], ["quark"]);
        console.timeEnd("PermissionManager.registerPermissions");
    }

    private registerPermission(permissionName: PermissionType, defaultPermission: "allow"|"deny", description: string, childrenNames: PermissionType[] = [], scopes: ("quark" | "channel")[] = ["quark", "channel"]) {
        let children = childrenNames.map(child => {
            let permission = PermissionManager.permissions[child].permission;
            if (!permission) throw new Error(`Child permission ${child} for parent ${permissionName} does not exist. Double check registration order.`);
            return permission;
        });
        console.debug(`Registering ${permissionName} with scopes ${scopes} and children ${childrenNames.join(", ")}`);
        PermissionManager.permissions[permissionName] = {permission: new Permission(permissionName, scopes, children), description: description, default: defaultPermission};
    }

    public static isRealPermission(permission: PermissionType) {
        return !!PermissionManager.permissions[permission];
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
        /*
        Determine if the user has the permission based on the following factors:
        - Channel permissions rule!! They override quark permissions even with higher priority.
        - Deny assignments deny! If a deny assignment has higher priority than an allow assignment, the permission is denied.
        - Allow assignments allow! If an allow assignment has higher priority than a deny assignment, the permission is allowed.
        - If no assignments are found, fallback to the default permission of the permission. this.permissions[permission].default
        - Roles linked to assignments have priorities, and the highest priority role is used, unless an assignment is found at channel scope.
        - Deny assignment takes priority if the priority and scope are the same.
         */

        // Determine which assignments are relevant
        let relevantAssignments = permissionAssignments.filter(assignment => {
            if (assignment.type === "ignore") return false;
            return this.permissions[assignment.permission].permission.grants(permission);
        })

        if (relevantAssignments.length === 0) {
            // No relevant assignments, fallback to default permission
            return this.permissions[permission].default === "allow";
        }

        // Great, narrowed down irrelevant assignments. Now, determine if the permission is granted or denied.

        // First, assign priorities to the assignments
        relevantAssignments = relevantAssignments.map(assignment => {
            assignment.priority = assignment.role.priority;
            return assignment;
        })

        if (!this.permissions[permission].permission.scopes.includes("channel")) {
            // For quark level actions, OWNER is always allowed
            let ownerAssignment = relevantAssignments.some(assignment => assignment.permission === "OWNER" && assignment.type === "allow");
            if (ownerAssignment) return true;
        }

        // Sort assignments by priority, and scope
        relevantAssignments.sort((a, b) => {
            let aValue = a.priority;
            let bValue = b.priority;
            if (a.scopeType === "channel" && b.scopeType !== "channel") aValue = Number.MAX_SAFE_INTEGER;
            if (a.scopeType !== "channel" && b.scopeType === "channel") bValue = Number.MAX_SAFE_INTEGER;
            if (a.scopeType === b.scopeType && a.priority === b.priority) {
                // Same priority and scope, deny takes priority
                if (a.type === "deny") aValue += 1;
                if (b.type === "deny") bValue += 1;
            }
            return bValue - aValue;
        });

        //console.log(relevantAssignments)
        // Now, the first assignment is the one that matters.
        let assignment = relevantAssignments[0];
        if (assignment.type === "deny") return false;
        if (assignment.type === "allow") return true;

        // If we get here, something went wrong, so just deny the permission
        return false
    }

    static async getAssignments(userId, scope: {scopeType: ("quark"|"channel"), scopeId, quarkId?}) {
        let assignments : any[] = [];
        if (!isValidObjectId(userId)) throw new Error(`PM: Invalid user id ${userId}`);
        if (!isValidObjectId(scope.scopeId)) throw new Error(`PM: Invalid ${scope.scopeType} ID ${scope.scopeId}`);
        if (scope?.quarkId && !isValidObjectId(scope.quarkId)) throw new Error(`PM: Invalid quark ID ${scope.quarkId}`);

        // If scope is a channel, and no quark id was provided, get the quark id from the channel
        let Quarks = db.getQuarks();
        let scopeId = scope.scopeId;
        let quarkId = scope.scopeId;
        let quark
        if (scope.scopeType === "channel" && !scope.quarkId) {
            quark = await Quarks.findOne({channels: new Types.ObjectId(scope.scopeId)});
            if (!quark) throw new Error(`PM: Channel ${scope.scopeId} does not exist.`);
            quarkId = quark._id;
        } else if (scope.scopeType === "channel") {
            quarkId = scope.quarkId;
        }
        if (!quark) {
            quark = await Quarks.findOne({_id: quarkId});
        }
        if (!quark) throw new Error(`PM: Quark ${scope.quarkId} does not exist.`);
        if (scope.scopeType === "channel" && !quark.channels.includes(scope.scopeId)) throw new Error(`PM: Channel ${scope.scopeId} is not in provided quark ${scope.quarkId}`)
        if (quark.owners.includes(String(userId))) {
            assignments.push({
                _id: ConstantID_OwnerAssignment,
                role: {
                    _id: ConstantID_OwnerRole,
                    name: "Owner",
                    quark: new Types.ObjectId(quarkId),
                    description: "Quark owner",
                    createdBy: ConstantID_SystemUser,
                    priority: Number.MAX_SAFE_INTEGER
                },
                scopeType: "quark",
                scopeId: new Types.ObjectId(quarkId),
                permission: "OWNER",
                type: "allow"
            })
        }
        if (!quark.members.includes(String(userId))) {
            // User is not a member, deny EVERYTHING
            assignments.push({
                _id: ConstantID_DenyAssignment,
                role: {
                    _id: ConstantID_DenyRole,
                    name: "Non-member",
                    quark: new Types.ObjectId(quarkId),
                    description: "Not a member",
                    createdBy: ConstantID_SystemUser,
                    priority: Number.MAX_SAFE_INTEGER
                },
                scopeType: "quark",
                scopeId: new Types.ObjectId(quarkId),
                permission: "ADMIN",
                type: "deny"
            })
            return assignments;
        }

        // Find all permission assignments that affect the user in this scope, both channel and quark level
        let PermissionAssignments = db.getPermissionAssignments();
        let RoleAssignments = db.getRoleAssignments();
        let userRoles = await RoleAssignments.find({ user: userId, quark: quarkId }).distinct("role");
        let defaultRoles =  await RoleAssignments.find({ isDefault: true, quark: quarkId }).distinct("role");
        const permissionAssignments = await PermissionAssignments.find({
            $or: [
                {
                    "role": { $in: userRoles },
                    "scopeType": "quark",
                    "scopeId": quarkId
                },
                {
                    "role": { $in: userRoles },
                    "scopeType": "channel",
                    "scopeId": scopeId
                },
                {
                    "role": { $in: defaultRoles },
                    "scopeType": "quark",
                    "scopeId": quarkId
                },
                {
                    "role": { $in: defaultRoles },
                    "scopeType": "channel",
                    "scopeId": scopeId
                }
            ]
        }).populate('role');

        assignments = [...assignments, ...permissionAssignments];
        return assignments
    }
}