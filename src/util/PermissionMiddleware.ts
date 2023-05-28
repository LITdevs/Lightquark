import PermissionManager from "../classes/permissions/PermissionManager.js";
import ForbiddenReply from "../classes/reply/ForbiddenReply.js";
import {isValidObjectId} from "mongoose";
import InvalidReplyMessage from "../classes/reply/InvalidReplyMessage.js";
import NotFoundReply from "../classes/reply/NotFoundReply.js";
import ServerErrorReply from "../classes/reply/ServerErrorReply.js";

/**
 * Permission check middleware
 * Calls next() if the user has the specified permission(s)
 * If not, replies with 403 Forbidden and missing permissions
 *
 * Usage:
 * ```js
 * app.get("/channels/:id", P("ADMIN", "channel"), (req, res) => { ... });
 * ```
 *
 * @param permissions {string|string[]} The permission(s) to check for
 * @param scope {string} The scope to check for, either "channel" or "quark". Assumes id is in req.params.id
 * @returns {Function} The middleware function
 */
export default function P(permissions : (PermissionType|PermissionType[]), scope: ("channel"|"quark")) : Function {
    return async (req, res, next) => {
        if (!isValidObjectId(req.params.id)) {
            return res.reply(new InvalidReplyMessage(`Invalid ${scope} ID`));
        }
        try {
            let check = await checkPermitted(permissions, { scopeType: scope, scopeId: req.params.id }, res.locals.user._id);
            if (!check.permitted) {
                return res.reply(new ForbiddenReply(`Missing permissions ${check.missingPermissions.join(", ")}`));
            }
            next();
        } catch (e : any) {
            if (e?.message?.includes("does not exist")) {
                return res.reply(new NotFoundReply(e.message));
            }
            console.error(e);
            return res.reply(new ServerErrorReply());
        }
    }
}

export async function checkPermittedQuarkResponse(permissions: (PermissionType|PermissionType[]), scopeId: string, userId: string, res) {
    try {
        let check = await checkPermittedQuark(permissions, scopeId, userId);
        if (!check.permitted) {
            res.reply(new ForbiddenReply(`Missing permissions ${check.missingPermissions.join(", ")}`));
            return false;
        } else {
            return true;
        }
    } catch (e : any) {
        if (e?.message?.includes("does not exist")) {
            res.reply(new NotFoundReply(e.message));
            return false;
        }
        if (e?.message?.includes("invalid")) {
            res.reply(new InvalidReplyMessage(e.message));
            return false;
        }
        console.error(e);
        res.reply(new ServerErrorReply());
        return false;
    }
}


export async function checkPermittedChannelResponse(permissions: (PermissionType|PermissionType[]), scopeId: string, userId: string, res, quarkId: undefined|string = undefined) {
    try {
        let check = await checkPermittedChannel(permissions, scopeId, userId, quarkId);
        if (!check.permitted) {
            res.reply(new ForbiddenReply(`Missing permissions ${check.missingPermissions.join(", ")}`));
            return false;
        } else {
            return true;
        }
    } catch (e : any) {
        if (e?.message?.includes("does not exist")) {
            res.reply(new NotFoundReply(e.message));
            return false;
        }
        if (e?.message?.includes("invalid")) {
            res.reply(new InvalidReplyMessage(e.message));
            return false;
        }
        console.error(e);
        res.reply(new ServerErrorReply());
        return false;
    }
}

export async function checkPermittedChannel(permissions: (PermissionType|PermissionType[]), scopeId: string, userId: string, quarkId: undefined|string = undefined) {
    return await checkPermitted(permissions, { scopeType: "channel", scopeId, quarkId }, userId);
}

export async function checkPermittedQuark(permissions: (PermissionType|PermissionType[]), scopeId: string, userId: string) {
    return await checkPermitted(permissions, { scopeType: "quark", scopeId }, userId);
}

export async function checkPermitted(permissions : (PermissionType|PermissionType[]), scope: { scopeType: "channel"|"quark", scopeId: string, quarkId?: string }, userId: string): Promise<({ permitted: true }|{ permitted: false, missingPermissions: string[]})> {
    if (typeof permissions === "string") {
        permissions = [permissions];
    }

    let missingPermissions : string[] = [];
    for (let permission of permissions) {
        if (!await PermissionManager.isPermitted(permission, userId, scope)) {
            missingPermissions.push(permission);
        }
    }
    if (missingPermissions.length > 0) {
        return { permitted: false, missingPermissions };
    }
    return { permitted: true };
}