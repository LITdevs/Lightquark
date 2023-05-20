import BasePermission from "./BasePermission.js";

export default class Permission extends BasePermission {
    // Permission with a scope, and potential child permissions
    scopes: ("quark" | "channel")[];
    children: (BasePermission|Permission)[];
    constructor(type : PermissionType, scopes : ("quark" | "channel")[], children : (BasePermission|Permission)[] = []) {
        super(type);
        this.scopes = scopes;
        this.children = children;
    }

    grants(permission : PermissionType) {
        // TODO: Hierarchy and stuff :(
        if (this.type === permission) return true;
        return this.children.some(child => child.grants(permission));
    }

    isBaseType() {
        return false;
    }

}