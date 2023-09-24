import express from 'express';
import db from "../../db.js";
import FormData from 'form-data';
import fs from "fs";
import Reply from "../../classes/reply/Reply.js";
import {fileTypeFromBuffer, FileTypeResult} from 'file-type';
import { Auth } from './auth.js';
import ServerErrorReply from "../../classes/reply/ServerErrorReply.js";
import {isUint8Array} from "util/types";
import axios from "axios";
import ForbiddenReply from "../../classes/reply/ForbiddenReply.js";
import InvalidReplyMessage from "../../classes/reply/InvalidReplyMessage.js";
import {subscriptionListener} from "../v1/gateway.js";
import {getNick} from "../../util/getNickname.js";
import {isValidObjectId} from "mongoose";
import RequiredProperties from "../../util/RequiredProperties.js";
import {getUserBulk} from "./channel.js";
import FeatureFlag from "../../util/FeatureFlagMiddleware.js";
import {ConstantID_SystemUser} from "../../util/ConstantID.js";
import {networkInformation} from "../../index.js";
import preference from "./user/preference.js";

const router = express.Router();

router.get("/me", Auth, (req, res) => {
    res.send(new Reply(200, true, {message: "Here is the data from your JWT, it is valid", jwtData: res.locals.user}));
});

router.get("/me/avatar", Auth, (req, res) => {
    res.redirect(res.locals.user.avatar);
})

router.get("/me/nick/:scope", Auth, async (req, res) => {
    try {
        let scope
        if (req.params.scope !== "global") {
            if (!isValidObjectId(req.params.scope)) return res.json(new InvalidReplyMessage("Scope must be a valid quark ID or 'global'"));
            scope = req.params.scope;
        }
        res.json(new Reply(200, true, {message: "Here is your nickname", nickname: await getNick(res.locals.user._id, scope)}));
    } catch (e) {
        res.json(new ServerErrorReply());
    }
})
router.put("/me/nick", Auth, async (req, res) => {
    if (!req.body.scope) return res.json(new InvalidReplyMessage("Provide a scope"));
    if (req.body.nickname && req.body.nickname.trim().length > 32) return res.json(new InvalidReplyMessage("Nickname must be 32 characters or less"));
    if (req.body.scope !== "global" && !isValidObjectId(req.body.scope)) return res.json(new InvalidReplyMessage("Scope must be a valid quark ID or 'global'"));
    try {
        const up = (scope, nickname) => {
            // Send update event
            let data = {
                eventId: "nicknameUpdate",
                userId: res.locals.user._id,
                nickname: nickname,
                scope: scope
            }
            subscriptionListener.emit("event", `me`, data);
        }

        if (req.body.scope === "global") {
            if (req.body.nickname) {
                let Nick = db.getNicks();
                await Nick.updateOne({userId: res.locals.user._id, scope: "global"},
                    {nickname: req.body.nickname.trim(), userId: res.locals.user._id, scope: "global"},
                    {upsert: true});
                up("global", req.body.nickname.trim())
                return res.json(new Reply(200, true, {message: "Nickname updated"}));
            } else {
                let Nick = db.getNicks();
                await Nick.deleteOne({userId: res.locals.user._id, scope: "global"});
                up("global", await getNick(res.locals.user._id));
                return res.json(new Reply(200, true, {message: "Nickname reset"}));
            }
        } else {
            let Quark = db.getQuarks();
            let quark = await Quark.findOne({_id: req.body.scope})
            if (!quark) return res.json(new Reply(404, false, {message: "Quark not found"}));
            if (!quark.members.includes(res.locals.user._id)) return res.json(new ForbiddenReply());

            if (req.body.nickname) {
                let Nick = db.getNicks();
                await Nick.updateOne({userId: res.locals.user._id, scope: req.body.scope},
                    {nickname: req.body.nickname.trim(), userId: res.locals.user._id, scope: req.body.scope},
                    {upsert: true});
                up(req.body.scope, req.body.nickname.trim())
                return res.json(new Reply(200, true, {message: "Nickname updated"}));
            } else {
                let Nick = db.getNicks();
                await Nick.deleteOne({userId: res.locals.user._id, scope: req.body.scope});
                up(req.body.scope, await getNick(res.locals.user._id));
                return res.json(new Reply(200, true, {message: "Nickname reset"}));
            }
        }
    } catch (e) {
        console.error(e);
        return res.status(500).json(new ServerErrorReply());
    }
})

/**
 * Upload a new avatar to Wanderer's Cloud from binary data in the request body
 * Change the user's avatar to the new avatar
 */
router.put("/me/avatar", Auth, async (req, res) => {
    if (!req.body || !isUint8Array(req.body)) return res.json(new Reply(400, false, {message: "Request body must be an image file in binary form"}));
    let fileType : FileTypeResult | undefined = await fileTypeFromBuffer(req.body);
    if (!fileType) return res.json(new Reply(400, false, {message: "Request body must be an image file in binary form"}));
    if (req.body.byteLength > 2097152) return res.json(new Reply(400, false, {message: "File size must be less than 2MiB"}));
    let formData = new FormData();
    let randomName = `${Math.floor(Math.random() * 1000000)}.${fileType.ext}`;
    fs.writeFileSync(`/share/wcloud/${randomName}`, req.body);
    formData.append("upload", fs.createReadStream(`/share/wcloud/${randomName}`));
    formData.submit({host: "upload.wanderers.cloud", headers: {authentication: process.env.WC_TOKEN}}, (err, response) => {
        if (err) return res.json(new ServerErrorReply());
        response.resume()
        response.once("data", async (data) => {
            let dataString = data.toString().trim();
            let Avatars = db.getAvatars();
            try {
                await Avatars.findOneAndUpdate({userId: res.locals.user._id}, {avatarUri: dataString}, {upsert: true});
                res.json(new Reply(200, true, {message: "Your avatar has been updated", avatar: dataString}));
                userUpdate(res.locals.user);
            } catch (err) {
                console.error(err);
                return res.json(new ServerErrorReply());
            }
        })
        response.once("end", () => {
            if (!fileType) return;
            fs.unlinkSync(`/share/wcloud/${randomName}`);
        })
    })
});

/**
 * Reset the user's avatar to the default avatar.
 * Default avatar is pulled from LITauth
 */
router.delete("/me/avatar", Auth, async (req, res) => {
    let Avatars = db.getAvatars();
    try {
        let avatar = await Avatars.findOneAndDelete({userId: res.locals.user._id});
        if (!avatar) return res.status(400).json(new InvalidReplyMessage("You do not have an avatar to delete"));
        axios.delete(`https://wanderers.cloud/file/${avatar.avatarUri.split("file/")[1].split(".")[0]}`, {headers: {authentication: process.env.WC_TOKEN}}).then((response) => {
            res.json(new Reply(200, true, {message: "Your avatar has been reset", avatar: `https://auth.litdevs.org/api/avatar/bg/${res.locals.user._id}`}));
            userUpdate(res.locals.user);
        })
    } catch (err) {
        console.error(err);
        return res.json(new ServerErrorReply());
    }
})

router.use("/me/preferences", preference);

/**
 * Find a user by their ID
 * @param req.params.id The ID of the user to find
 */
router.get("/:id", Auth, async (req, res) => {
    let Users = db.getLoginUsers();

    // Return system user info, since it's not in the database
    if (req.params.id === String(ConstantID_SystemUser)) {
        res.reply(new Reply(200, true, {message: "User found", user: {
                _id: ConstantID_SystemUser,
                username: "System",
                admin: true,
                avatarUri: `${networkInformation.baseUrl}/systemUser.webp`,
                isBot: false
            }}))
        return;
    }

    // Find the user by their ID
    try {
        let user = await Users.findOne({_id: req.params.id});
        if (!user) return res.json(new Reply(404, false, {message: "User not found"}));
        let Avatars = db.getAvatars();
        // Find the avatar of the user
        let avatar = Avatars.findOne({userId: user._id});
        if (!avatar) avatar = { avatarUri: `https://auth.litdevs.org/api/avatar/bg/${user._id}`};
        let safeUser = {
            _id: user._id,
            username: await getNick(user._id),
            avatarUri: avatar.avatarUri,
            admin: !!user.admin,
            isBot: !!user.isBot
        }
        res.json(new Reply(200, true, {message: "User found", user: safeUser}));
    } catch (err) {
        console.error(err)
        return res.status(500).json(new ServerErrorReply());
    }
})

router.post("/bulk", Auth, FeatureFlag("LQ_UserBulkEndpoint"), RequiredProperties([
    {
        property: "users",
        isArray: true
    },
    {
        property: "quark",
        optional: true,
        type: "string"
    }
]), async (req, res) => {
    let invalidIds : any[] = [];
    req.body.users.forEach((user) => {
        if (typeof user !== "string" || !isValidObjectId(user)) invalidIds.push(user);
    })
    if (invalidIds.length > 0) return res.reply(new InvalidReplyMessage(`Invalid IDs: ${invalidIds.join(", ")}`))
    if (req.body.quark && !isValidObjectId(req.body.quark)) return res.reply(new InvalidReplyMessage("Invalid quark ID"))

    let bulkUsers = await getUserBulk(req.body.users, req.body.quark || undefined);

    res.reply(new Reply(200, true, { message: "Users retrieved", users: bulkUsers }))
})

/**
 * Send memberUpdate event to all quarks the user is in
 * @param user
 */
async function userUpdate(user : any) {
    let Quarks = db.getQuarks();
    try {
        let quarks = await Quarks.find({members: user._id});
        for (const quark of quarks) {
            // Send update event
            let data = {
                eventId: "memberUpdate",
                quark: quark,
                user: { _id: user._id, username: await getNick(user._id, quark._id), avatarUri: user.avatar, admin: !!user.admin }
            }
            subscriptionListener.emit("event", `quark_${quark._id}` , data);
        }
    } catch (err) {
        if (err) {
            console.error(err);
            return;
        }
    }
}

export default router;
