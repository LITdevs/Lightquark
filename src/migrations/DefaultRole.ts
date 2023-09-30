import db from "../db.js";
import {ConstantID_SystemUser} from "../util/ConstantID.js";

/**
 * Adds missing default role to all quarks older than 2023-06-01
 */
export default async function () {
    let Quarks = db.getQuarks();
    let quarks = await Quarks.find({ _id: { $lt: "64785e100000000000000000" } }).populate("roles")
    quarks = quarks.filter(quark => !quark.roles.some(role => role.isDefault));
    for (const quark of quarks) {
        let Role = db.getRoles();
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
    console.info(`Added default role to ${quarks.length} quarks`)
}