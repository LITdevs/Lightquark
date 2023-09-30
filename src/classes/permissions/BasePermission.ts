export default class BasePermission {
    // The simplest form of permission
    type: PermissionType;
    constructor(type : PermissionType) {
        this.type = type;
    }

    grants(permission : PermissionType) {
        return this.type === permission;
    }

    isBaseType() {
        return true;
    }
}