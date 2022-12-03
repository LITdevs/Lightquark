import express, {Request, Response, Router} from 'express';
import db from "../db.js";
import FormData from 'form-data';
import fs from "fs";
import Reply from "../classes/reply/Reply.js";
import {fileTypeFromBuffer, FileTypeResult} from 'file-type';
import { Auth } from './auth.js';
import ServerErrorReply from "../classes/reply/ServerErrorReply.js";
import {isUint8Array} from "util/types";

const router: Router = express.Router();

router.get("/me", Auth, (req, res) => {
    res.send(new Reply(200, true, {message: "Here is the data from your JWT, it is valid", jwtData: res.locals.user}));
});

router.get("/me/avatar", Auth, (req, res) => {
    res.redirect(res.locals.user.avatar);
})

/**
 * Upload a new avatar to Wanderer's Cloud from binary data in the request body
 * Change the user's avatar to the new avatar
 */
router.put("/me/avatar", Auth, async (req, res) => {
    if (!req.body || !isUint8Array(req.body)) return res.json(new Reply(400, false, {message: "Request body must be an image file in binary form"}));
    let fileType : FileTypeResult | undefined = await fileTypeFromBuffer(req.body);
    if (!fileType) return res.json(new Reply(400, false, {message: "Request body must be an image file in binary form"}));
    let formData = new FormData();
    fs.writeFileSync(`/share/wcloud/tmp.${fileType.ext}`, req.body);
    formData.append("upload", fs.createReadStream(`/share/wcloud/tmp.${fileType.ext}`));
    formData.submit({host: "upload.wanderers.cloud", headers: {authentication: process.env.WC_TOKEN}}, (err, response) => {
        if (err) return res.json(new ServerErrorReply());
        response.resume()
        response.once("data", (data) => {
            let dataString = data.toString().trim();
            let Avatars = db.getAvatars();
            Avatars.findOneAndUpdate({userId: res.locals.user._id}, {avatarUri: dataString}, {upsert: true}, (err, avatar) => {
                if (err) return res.json(new ServerErrorReply());
                res.json(new Reply(200, true, {message: "Your avatar has been updated", avatar: avatar.avatarUri}));
            })
        })
        response.once("end", () => {
            if (!fileType) return;
            fs.unlinkSync(`/share/wcloud/tmp.${fileType.ext}`);
        })
    })
});

/**
 * Reset the user's avatar to the default avatar.
 * Default avatar is pulled from LITauth
 */
router.delete("/me/avatar", Auth, (req, res) => {
    let Avatars = db.getAvatars();
    Avatars.findOneAndDelete({userId: res.locals.user._id}, (err) => {
        if (err) return res.json(new ServerErrorReply());
        res.json(new Reply(200, true, {message: "Your avatar has been reset", avatar: `https://auth.litdevs.org/api/avatar/bg/${res.locals.user._id}`}));
    })
})

export default router;