import Permission from "./Permission.js";

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
}