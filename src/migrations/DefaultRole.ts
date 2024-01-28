import {ConstantID_DMvQuark, ConstantID_SystemUser} from "../util/ConstantID.js";
import Database from "../db.js";
const db = new Database()

/**
 * Adds missing default role to all quarks older than 2023-06-01
 */
export default async function () {
    let Quarks = db.Quarks;
    let quarks = await Quarks.find({ _id: { $lt: "64785e100000000000000000" } }).populate("roles")
    quarks = quarks.filter(quark => !quark.roles.some(role => role.isDefault));
    let Role = db.Roles;
    for (const quark of quarks) {
        let role = new Role({
            name: "all",
            color: undefined,
            quark: quark._id,
            description: "The default role",
            createdBy: ConstantID_SystemUser,
            priority: 0,
            isDefault: true
        })
        await role.save();
    }

    let dmDefaultRole = await Role.findOne({quark: ConstantID_DMvQuark})
    if (!dmDefaultRole) {
        let role = new Role({
            name: "all",
            color: undefined,
            quark: ConstantID_DMvQuark,
            description: "The default role",
            createdBy: ConstantID_SystemUser,
            priority: 0,
            isDefault: true
        })
        await role.save();
        dmDefaultRole = role;
    }

    let PermissionAssignment = db.PermissionAssignments;
    let dmDefaultPermission = await PermissionAssignment.findOne({scopeId: ConstantID_DMvQuark, role: dmDefaultRole._id })
    if (!dmDefaultPermission) {
        let permissionAssignment = new PermissionAssignment({
            role: dmDefaultRole._id,
            permission: "READ_CHANNEL",
            type: "deny",
            scopeType: "quark",
            scopeId: ConstantID_DMvQuark
        })
        await permissionAssignment.save();
        dmDefaultPermission = permissionAssignment
    }

    console.info(`Added default role to ${quarks.length} quarks`)
}