import express from 'express';
import Reply from "../../classes/reply/Reply.js";
import {Auth} from "./auth.js";
import {isValidObjectId} from "mongoose";
import InvalidReplyMessage from "../../classes/reply/InvalidReplyMessage.js";
import Database from "../../db.js";
import NotFoundReply from "../../classes/reply/NotFoundReply.js";
import ServerErrorReply from "../../classes/reply/ServerErrorReply.js";
import {safeUser} from "../../util/safeUser.js";

const router = express.Router();

const database = new Database()

router.use(Auth);

router.get("/me", (req, res) => {
    try {
        res.reply(new Reply(200, true, {
            message: "You are signed in. Here is your data",
            jwtData: res.locals.user
        }))
    } catch (e) {
        console.error(e)
        return res.reply(new ServerErrorReply())
    }
})

router.get("/:userId",  async (req, res) => {
    try {
        if (!isValidObjectId(req.params.userId)) return res.reply(new InvalidReplyMessage("Invalid user"));
        let user = await database.LoginUsers.findOne({_id: req.params.userId});
        if (!user) return res.reply(new NotFoundReply("No such user"))

        res.reply(new Reply(200, true, {
            message: "User found",
            user: safeUser(user)
        }))
    } catch (e) {
        console.error(e)
        return res.reply(new ServerErrorReply())
    }
})

export default router;
