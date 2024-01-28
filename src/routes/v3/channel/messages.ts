import express from 'express';
import Database from "../../../db.js";
import {Auth} from "../auth.js";
import Reply from "../../../classes/reply/Reply.js";
import P from "../../../util/PermissionMiddleware.js";
import ServerErrorReply from "../../../classes/reply/ServerErrorReply.js";
import InvalidReplyMessage from "../../../classes/reply/InvalidReplyMessage.js";
import {Types} from "mongoose";
import messageSchema from "../../../schemas/messageSchema.js";
import {getNickBulk} from "../../../util/getNickname.js";

const router = express.Router({ mergeParams: true });

const database = new Database()

router.use(Auth);

router.get("/", P(["READ_CHANNEL_HISTORY", "READ_CHANNEL"], "channel"), async (req, res) => {
    try {
        // Optionally client can provide a timestamp to get messages before or after
        let startTimestamp = Infinity;
        let endTimestamp = 0;
        if (req.query.startTimestamp) startTimestamp = Number(req.query.startTimestamp)
        if (req.query.endTimestamp) endTimestamp = Number(req.query.endTimestamp)
        if (isNaN(startTimestamp)) return res.status(400).json(new InvalidReplyMessage("Invalid startTimestamp"));
        if (isNaN(endTimestamp)) return res.status(400).json(new InvalidReplyMessage("Invalid endTimestamp"));

        let quark = await database.Quarks.findOne({ channels: new Types.ObjectId(req.params.channelId) });

        // Find messages in specified range, if endTimestamp is specified get messages after that timestamp, otherwise get messages before that timestamp
        // The naming is a bit backwards, isn't it?
        let messages = await database.Messages.find({ channelId: req.params.channelId, timestamp: { $lt: startTimestamp, $gt: endTimestamp } }).sort({ timestamp: endTimestamp === 0 ? -1 : 1 }).limit(50)
        // Replace author usernames with nicknames in this quark
        let authorIds = messages.map(message => message.authorId);
        let nicknames = await getNickBulk(authorIds, quark._id)
        messages = messages.map(message => {
            message.author.username = nicknames.find(nick => nick.userId.equals(message.authorId)).nickname || message.author.username;
            return message;
        })
        res.reply(new Reply(200, true, {message: "Here are the messages", messages}));
    } catch (e) {
        console.error(e);
        return res.status(500).json(new ServerErrorReply());
    }
})


export default router;
