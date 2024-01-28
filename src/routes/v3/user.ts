import express from 'express';
import Reply from "../../classes/reply/Reply.js";
import {Auth} from "./auth.js";
import {isValidObjectId} from "mongoose";
import InvalidReplyMessage from "../../classes/reply/InvalidReplyMessage.js";
import Database from "../../db.js";
import NotFoundReply from "../../classes/reply/NotFoundReply.js";


const router = express.Router();

const database = new Database()

router.use(Auth);

router.get("/me", (req, res) => {
    res.reply(new Reply(200, true, {
        message: "You are signed in. Here is your data",
        jwtData: res.locals.user
    }))
})

router.get("/:userId",  async (req, res) => {
    if (!isValidObjectId(req.params.userId)) return res.reply(new InvalidReplyMessage("Invalid user"));
    let user = await database.LoginUsers.findOne({_id: req.params.userId});
    if (!user) return res.reply(new NotFoundReply("No such user"))
    
    res.reply(new Reply(200, true, {
        message: "User found",
        user: safeUser(user)
    }))
})

export function safeUser(user) {
    return {
        username: user.username, 
        _id: user._id,
        admin: user.admin, 
        isBot: user.isBot,
        avatarUri: user.avatarUri,
        status: user.status
    }
}

export default router;
