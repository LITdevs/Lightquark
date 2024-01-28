import express from 'express';
import {Auth} from "./auth.js";
import Database from "../../db.js";
import P from "../../util/PermissionMiddleware.js";
import {isValidObjectId} from "mongoose";
import InvalidReplyMessage from "../../classes/reply/InvalidReplyMessage.js";
import NotFoundReply from "../../classes/reply/NotFoundReply.js";
import Reply from "../../classes/reply/Reply.js";
import ServerErrorReply from "../../classes/reply/ServerErrorReply.js";
import messages from "./channel/messages.js";


const router = express.Router();

const database = new Database()

router.use(Auth);

router.use("/:channelId/messages", messages)

router.get("/:channelId", P("READ_CHANNEL", "channel"), async (req, res) => {
    try {
        // Validity and existence are checked by permission manager
        let channel = await database.Channels.findOne({ _id: req.params.channelId })
        res.reply(new Reply(200, true, { message: "Here is the channel", channel }))
    } catch (e) {
        console.error(e);
        res.reply(new ServerErrorReply())
    }
})


export default router;
