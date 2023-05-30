import express from 'express';
import Auth from "../../../util/Auth.js";
import db from "../../../db.js";
import Reply from "../../../classes/reply/Reply.js";
import {isValidObjectId, Types} from "mongoose";
import NotFoundReply from "../../../classes/reply/NotFoundReply.js";
import RequiredProperties from "../../../util/RequiredProperties.js";
import {checkPermittedQuarkResponse} from "../../../util/PermissionMiddleware.js";

const router = express.Router({
    mergeParams: true
});

/**
 * Get all roles in a quark
 */
router.get('/', Auth, async (req, res) => {
    if (!isValidObjectId(req.params.quarkId)) return res.reply(new Reply(400, false, { message: "Invalid quark ID" }));
    let Roles = db.getRoles();
    let roles = await Roles.find({quark: req.params.quarkId}).populate('permissionAssignments').populate('roleAssignments');
    res.reply(new Reply(200, true, { message: "Roles found", roles: roles }));
});

/**
 *
 */
router.post('/', Auth, RequiredProperties([
    {
        property: "name",
        type: "string",
        trim: true,
        minLength: 1,
        maxLength: 54
    },
    {
        property: "color",
        regex: /^#([0-9a-f]{3}){1,2}$/i, // Trusting copilot on this one
        optional: true
    },
    {
        property: "description",
        type: "string",
        minLength: 1,
        maxLength: 1024,
        trim: true,
        optional: true
    },
    {
        property: "priority",
        type: "number",
        min: 1,
        max: Number.MAX_SAFE_INTEGER
    }
]), async (req, res) => {
    if (!isValidObjectId(req.params.quarkId)) return res.reply(new Reply(400, false, { message: "Invalid quark ID" }));
    if (!(await checkPermittedQuarkResponse("EDIT_QUARK_ROLES", req.params.quarkId, res.locals.user._id, res))) return;
    let Role = db.getRoles();
    let newRole = new Role({
        name: req.body.name.trim(),
        color: req.body.color || undefined,
        quark: new Types.ObjectId(req.params.quarkId),
        description: req.body.description || "",
        createdBy: new Types.ObjectId(res.locals.user._id),
        priority: req.body.priority,
        isDefault: false
    })
    await newRole.save();
    res.reply(new Reply(201, true, { message: "Role created", role: newRole}));
});

router.get('/:roleId', Auth, async (req, res) => {
    if (!isValidObjectId(req.params.roleId)) return res.reply(new Reply(400, false, { message: "Invalid role ID" }));
    if (!isValidObjectId(req.params.quarkId)) return res.reply(new Reply(400, false, { message: "Invalid quark ID" }));
    let Roles = db.getRoles();
    let role = await Roles.findOne({_id: req.params.roleId, quark: req.params.quarkId}).populate('permissionAssignments').populate('roleAssignments');
    if (!role) return res.reply(new NotFoundReply("Role not found"));
    res.reply(new Reply(200, true, { message: "Role found", role: role }));
});

router.patch('/:roleId', Auth, RequiredProperties([
    {
        property: "name",
        type: "string",
        trim: true,
        minLength: 1,
        maxLength: 54,
        optional: true
    },
    {
        property: "color",
        regex: /^((#([0-9a-f]{3}){1,2})|(0))$/i,
        optional: true,
        regexFailMessage: "Color must be a hex color code or 0 (no color)"
    },
    {
        property: "description",
        type: "string",
        minLength: 1,
        maxLength: 1024,
        trim: true,
        optional: true
    },
    {
        property: "priority",
        type: "number",
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
        optional: true
    },
    {
        property: "permissions",
        isArray: true,
        optional: true
    }
]), async (req, res) => {
    // i dont want to write this
    // permissions array should be translated to permissionAssignments

    if (!isValidObjectId(req.params.roleId)) return res.reply(new Reply(400, false, { message: "Invalid role ID" }));
    if (!isValidObjectId(req.params.quarkId)) return res.reply(new Reply(400, false, { message: "Invalid quark ID" }));
    if (!(await checkPermittedQuarkResponse("EDIT_QUARK_ROLES", req.params.quarkId, res.locals.user._id, res))) return;

    let Roles = db.getRoles();
    let role = await Roles.findOne({_id: req.params.roleId, quark: req.params.quarkId});
    if (!role) return res.reply(new NotFoundReply("Role not found"));
    if (role.isDefault) req.body.priority = 0; // Default roles cannot be prioritized

    if (req.body.name) role.name = req.body.name.trim();

    if (req.body.color) role.color = req.body.color === "0" ? undefined : req.body.color

    if (req.body.description) role.description = req.body.description;

    if (req.body.priority) role.priority = req.body.priority;

    if (req.body.permissions) {
        return res.reply(new Reply(501, false, { message: "Not implemented" }));
    }

    await role.save();
    res.reply(new Reply(200, true, { message: "Role updated", role: role }));
});

router.delete('/:roleId', Auth, async (req, res) => {
    if (!isValidObjectId(req.params.quarkId)) return res.reply(new Reply(400, false, { message: "Invalid quark ID" }));
    if (!isValidObjectId(req.params.roleId)) return res.reply(new Reply(400, false, { message: "Invalid role ID" }));
    if (!(await checkPermittedQuarkResponse("EDIT_QUARK_ROLES", req.params.quarkId, res.locals.user._id, res))) return;

    let Roles = db.getRoles();
    let deletion = await Roles.deleteOne({_id: req.params.roleId, quark: req.params.quarkId, isDefault: false });
    if (deletion.deletedCount === 0) return res.reply(new NotFoundReply("Role not found"));
    res.reply(new Reply(200, true, { message: "Role deleted" }));

    // TODO: Do this as a hook #LIGHTQUARK-40
    let RoleAssignments = db.getRoleAssignments();
    await RoleAssignments.deleteMany({role: req.params.roleId});
    let PermissionAssignments = db.getPermissionAssignments();
    await PermissionAssignments.deleteMany({role: req.params.roleId});

});

export default router;