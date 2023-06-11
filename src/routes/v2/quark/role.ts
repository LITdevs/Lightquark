import express from 'express';
import Auth from "../../../util/Auth.js";
import db from "../../../db.js";
import Reply from "../../../classes/reply/Reply.js";
import {isValidObjectId, Types} from "mongoose";
import NotFoundReply from "../../../classes/reply/NotFoundReply.js";
import RequiredProperties from "../../../util/RequiredProperties.js";
import {checkPermittedQuarkResponse} from "../../../util/PermissionMiddleware.js";
import PermissionManager from "../../../classes/permissions/PermissionManager.js";
import InvalidReplyMessage from "../../../classes/reply/InvalidReplyMessage.js";
import ServerErrorReply from "../../../classes/reply/ServerErrorReply.js";

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

router.get('/me', Auth, async (req, res) => {
    if (!isValidObjectId(req.params.quarkId)) return res.reply(new Reply(400, false, { message: "Invalid quark ID" }));
    let Roles = db.getRoles();
    let assignments = await Roles.find({quark: req.params.quarkId}).populate("roleAssignments").populate("permissionAssignments")
    assignments = assignments.filter(role => {
        if (role.isDefault) return true;
        return role.roleAssignments.some(assignment => String(assignment.user) === String(res.locals.user._id))
    })
    res.reply(new Reply(200, true, { message: "Here is the list", assignments }))
})


router.get('/permissions', Auth, async (req, res) => {
    if (!isValidObjectId(req.params.quarkId)) return res.reply(new Reply(400, false, { message: "Invalid quark ID" }));
    try {
        let assignments = await PermissionManager.getAssignments(res.locals.user._id, {scopeType: "quark", scopeId: req.params.quarkId});
        res.reply(new Reply(200, true, { message: "List of your permission assignments in quark scope", assignments }));
    } catch (e : any) {
        if (e.message.startsWith("PM:")) {
            res.reply(new InvalidReplyMessage(e.message))
        } else {
            res.reply(new ServerErrorReply())
            console.error(e)
        }
    }
})

router.get('/permissions/:channelId', Auth, async (req, res) => {
    if (!isValidObjectId(req.params.quarkId)) return res.reply(new Reply(400, false, { message: "Invalid quark ID" }));
    if (!isValidObjectId(req.params.channelId)) return res.reply(new Reply(400, false, { message: "Invalid channel ID" }));
    try {
        let assignments = await PermissionManager.getAssignments(res.locals.user._id, {scopeType: "channel", scopeId: req.params.channelId, quarkId: req.params.quarkId});
        res.reply(new Reply(200, true, { message: "List of your permission assignments in channel scope", assignments }))
    } catch (e : any) {
        if (e.message.startsWith("PM:")) {
            res.reply(new InvalidReplyMessage(e.message))
        } else {
            res.reply(new ServerErrorReply())
            console.error(e)
        }
    }
})

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
        let Quarks = db.getQuarks();
        let quark = await Quarks.findOne({_id: req.params.quarkId});
        if (!quark) return res.reply(new NotFoundReply("Quark not found"));

        // Perform validation
        for (const permission of req.body.permissions) {
            if (typeof permission !== "object") return res.reply(new InvalidReplyMessage("Permissions must be an array of objects"));
            if (!permission.hasOwnProperty("permission")) return res.reply(new InvalidReplyMessage("Permissions must have a permission property"));
            if (typeof permission.permission !== "string") return res.reply(new InvalidReplyMessage("Permission property must be a string"));
            if (!permission.hasOwnProperty("type")) return res.reply(new InvalidReplyMessage("Permissions must have a type property"));
            if (!["allow", "deny", "ignore"].includes(permission.type)) return res.reply(new InvalidReplyMessage("Type property must be in enum ['allow', 'deny', 'ignore']"));
            if (!permission.hasOwnProperty("scopeType")) return res.reply(new InvalidReplyMessage("Permissions must have a scopeType property"));
            if (!["quark", "channel"].includes(permission.scopeType)) return res.reply(new InvalidReplyMessage("scopeType property must be in enum ['quark', 'channel']"));
            if (permission.scopeType === "channel" && !permission.hasOwnProperty("scopeId")) return res.reply(new InvalidReplyMessage("Permissions must have a scopeId property if scopeType is channel"));
            if (permission.scopeType === "channel" && !isValidObjectId(permission.scopeId)) return res.reply(new InvalidReplyMessage("scopeId property must be a valid object ID"));
            if (permission.scopeType === "channel") {
                if (!quark.channels.includes(permission.scopeId)) return res.reply(new InvalidReplyMessage("Channel ID is not a channel in this quark"));
            }
            if (!PermissionManager.isRealPermission(permission.permission)) return res.reply(new InvalidReplyMessage(`Unknown permission ${permission.permission}`));
            if (!PermissionManager.permissions[permission.permission].permission.scopes.includes(permission.scopeType)) return res.reply(new InvalidReplyMessage(`Permission ${permission.permission} does not support scope type ${permission.scopeType}`));
            const dupes = req.body.permissions.filter(perm => perm.permission === permission.permission && perm.scopeId === permission.scopeId);
            if (dupes.length > 1) return res.reply(new InvalidReplyMessage(`Duplicate permission: ${permission.permission} is assigned ${dupes.length} times`));
        }

        for (const permission of req.body.permissions) {
            const permissionObject = PermissionManager.permissions[permission.permission].permission;
            for (const childPermission of permissionObject.children) {

                const childPermissionAssignment = req.body.permissions.find(perm => perm.scopeId === permission.scopeId && perm.permission === childPermission.type);
                if (!childPermissionAssignment) {
                    // No assignment for this child
                    continue;
                }
                // Check if a child permission is being denied while the parent is allowed (and reject the edit)
                if (childPermissionAssignment.type === "deny" && permission.type === "allow") {
                    return res.reply(new InvalidReplyMessage(`Permission conflict: You can't deny ${childPermission.type} while allowing ${permission.permission}`));
                }
            }
        }
        let PermissionAssignments = db.getPermissionAssignments();
        // Delete old assignments
        let deletion = PermissionAssignments.deleteMany({role: role._id});

        let assignments : any[] = [];

        // Create new assignments from req.body.permissions
        for (const permission of req.body.permissions) {
            assignments.push(new PermissionAssignments({
                role: role._id,
                permission: permission.permission,
                type: permission.type,
                scopeType: permission.scopeType,
                // For quark scopeType, scopeId may not actually be correct (it may be a channel ID if the client is trying to break the system)
                scopeId: permission.scopeType === "channel" ? new Types.ObjectId(permission.scopeId) : role.quark
            }));
        }

        // Make sure deletion is done
        await deletion;

        let assignmentSavePromises = assignments.map(assignment => assignment.save());

        await Promise.all(assignmentSavePromises);
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