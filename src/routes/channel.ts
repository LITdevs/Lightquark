import express, {Request, Response, Router} from 'express';
import Reply from "../classes/reply/Reply.js";
import { Auth } from './auth.js';
import db from "../db.js";
import * as mongoose from "mongoose";
import ServerErrorReply from "../classes/reply/ServerErrorReply.js";
import InvalidReplyMessage from "../classes/reply/InvalidReplyMessage.js";
import {isValidObjectId} from "mongoose";
import NotFoundReply from "../classes/reply/NotFoundReply.js";
import ForbiddenReply from "../classes/reply/ForbiddenReply.js";
import {fileTypeFromBuffer, FileTypeResult} from "file-type";
import fs from "fs";
import FormData from "form-data";
import axios from "axios";
import {subscriptionListener} from "./gateway.js";

const router: Router = express.Router();

router.all("/", Auth, (req: Request, res: Response) => {
    res.status(400).json(new InvalidReplyMessage("Provide a channel id"));
})

/**
 * Get channel by id
 */
router.get("/:id", Auth, (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a channel id"));
    if (!isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid channel id"));
    let Channels = db.getChannels();
    Channels.findOne({ _id: req.params.id }, (err, channel) => {
        if (err) {
            console.error(err);
            return res.status(500).json(new ServerErrorReply());
        }
        if (!channel) return res.status(404).json(new NotFoundReply("Channel not found"));
        let Quarks = db.getQuarks();
        Quarks.findOne({ _id: channel.quark, channels: channel._id, members: res.locals.user._id}, (err, quark) => {
            if (err) {
                console.error(err);
                return res.status(500).json(new ServerErrorReply());
            }
            if (!quark) return res.status(403).json(new ForbiddenReply("You do not have permission to view this channel"));
            res.json(new Reply(200, true, {message: "Here is the channel", channel}));
        })
    })
})

/**
 * Delete a channel by id
 */
// TODO: Allow roles to delete channels
router.delete("/:id", Auth, (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a channel id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid channel id"));
    let Channels = db.getChannels();
    // Find the channel
    Channels.findOne({ _id: req.params.id }, (err, channel) => {
        if (err) {
            console.error(err);
            return res.status(500).json(new ServerErrorReply());
        }
        if (!channel) return res.status(404).json(new NotFoundReply("Channel not found"));
        let Quarks = db.getQuarks();
        // If the user is the owner of the quark, they can delete channels in it
        Quarks.findOne({ _id: channel.quark, channels: channel._id, owners: res.locals.user._id}, (err, quark) => {
            if (err) {
                console.error(err);
                return res.status(500).json(new ServerErrorReply());
            }
            if (!quark) return res.status(403).json(new ForbiddenReply("You do not have permission to delete this channel"));
            // Remove channel from quark
            quark.channels.splice(quark.channels.indexOf(channel._id), 1);
            // Delete channel
            Channels.deleteOne({ _id: channel._id }, (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json(new ServerErrorReply());
                }
                // Save quark
                quark.save((err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json(new ServerErrorReply());
                    }
                    // Return success
                    res.json(new Reply(200, true, {message: "Channel deleted"}));

                    // Send delete event
                    let data = {
                        eventId: "channelDelete",
                        channel: channel,
                        quark: quark
                    }
                    subscriptionListener.emit("event", `quark_${channel.quark}` , data);
                })
            })
        })

    })
})


/**
 * Edit a channel by id
 */
// TODO: Allow roles to edit channels
router.patch("/:id", Auth, (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a channel id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid channel id"));
    let Channels = db.getChannels();
    Channels.findOne({ _id: req.params.id }, (err, channel) => {
        if (err) {
            console.error(err);
            return res.status(500).json(new ServerErrorReply());
        }
        if (!channel) return res.status(404).json(new NotFoundReply("Channel not found"));
        let Quarks = db.getQuarks();
        Quarks.findOne({ _id: channel.quark, channels: channel._id, owners: res.locals.user._id}, (err, quark) => {
            if (err) {
                console.error(err);
                return res.status(500).json(new ServerErrorReply());
            }
            if (!quark.owners.includes(res.locals.user._id)) return res.status(403).json(new Reply(403, false, {message: "You are not an owner of this quark"}));
            // Update name
            if (req.body.name) {
                if (req.body.name.length > 64) return res.status(400).json(new Reply(400, false, {message: "Name must be less than 64 characters"}));
                channel.name = req.body.name.trim();
            }
            // Update description
            if (typeof req.body.description !== "undefined") {
                channel.description = String(req.body.description).trim();
            }
            // Save the channel
            channel.save((err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json(new ServerErrorReply());
                }
                res.json(new Reply(200, true, {message: "Channel updated", channel}));
                // Send update event
                let data = {
                    eventId: "channelUpdate",
                    channel: channel,
                    quark: quark
                }
                subscriptionListener.emit("event", `quark_${channel.quark}` , data);
            });
        })
    })
})

/**
 * Create a channel
 */
router.post("/create", Auth, (req, res) => {
    if (!req.body.quark) return res.status(400).json(new InvalidReplyMessage("Provide a quark id"));
    if (!mongoose.isValidObjectId(req.body.quark)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    if (!req.body.name) return res.status(400).json(new InvalidReplyMessage("Provide a channel name"));
    if (req.body.name.trim().length > 64) return res.status(400).json(new Reply(400, false, {message: "Name must be less than 64 characters"}));
    let Quarks = db.getQuarks();
    Quarks.findOne({ _id: req.body.quark, owners: res.locals.user._id }, (err, quark) => {
        if (err) {
            console.error(err);
            return res.status(500).json(new ServerErrorReply());
        }
        if (!quark) return res.status(404).json(new NotFoundReply("Quark not found or you are not an owner"));
        let Channel = db.getChannels();
        let channel = new Channel({
            _id: new mongoose.Types.ObjectId(),
            name: req.body.name.trim(),
            description: req.body.description ? String(req.body.description).trim() : "",
            quark: quark._id
        });
        channel.save((err) => {
            if (err) {
                console.error(err);
                return res.status(500).json(new ServerErrorReply());
            }
            quark.channels.push(channel._id);
            quark.save((err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json(new ServerErrorReply());
                }
                res.json(new Reply(200, true, {message: "Channel created", channel}));
                // Send create event
                let data = {
                    eventId: "channelCreate",
                    channel: channel,
                    quark: quark
                }
                subscriptionListener.emit("event", `quark_${channel.quark}` , data);
            })
        })
    })
})

router.get("/:id/messages", Auth, async (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a channel id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid channel id"));

    try {
        let canRead = await isPermittedToRead(req.params.id, res.locals.user._id);
        if (!canRead) return res.status(403).json(new ForbiddenReply("You do not have permission to read this channel"));
        let messages = db.getMessages();
        // Optionally client can provide a timestamp to get messages before
        let startTimestamp = Infinity;
        if (req.query.startTimestamp) startTimestamp = Number(req.query.startTimestamp)
        if (isNaN(startTimestamp)) return res.status(400).json(new InvalidReplyMessage("Invalid startTimestamp"));

        let query = messages.find({ channelId: req.params.id, timestamp: { $lt: startTimestamp } }).sort({ timestamp: -1 });
        query.limit(50);
        query.then(async (messages) => {
            for (let i = 0; i < messages.length; i++) {
                messages[i] = { message: messages[i], author: await getUser(messages[i].authorId) };
                try {
                    let ua = JSON.parse(messages[i].message.ua);
                    messages[i].message.ua = ua.name;
                } catch (e) {
                    // Ignore error, just let it be.
                    // This is the default behaviour
                    // A certain client sends the user agent as a bit of JSON, which messes with all the other ones
                    // So we will try to parse it and return the correct value.
                }
            }
            res.json(new Reply(200, true, {message: "Here are the messages", messages}));
        })
    } catch (e) {
        console.error(e);
        return res.status(500).json(new ServerErrorReply());
    }
})

router.post("/:id/messages", Auth, async (req, res) => {
    try {
        if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a channel id"));
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid channel id"));
        if (!req.body.content && !req.body.attachments) return res.status(400).json(new InvalidReplyMessage("Provide a message content"));
        if (req.body.content.trim().length > 2000) return res.status(400).json(new Reply(400, false, {message: "Message content must be less than 2000 characters"}));
        if (req.body.attachments && !Array.isArray(req.body.attachments)) return res.status(400).json(new InvalidReplyMessage("Attachments must be an array"));
        if (req.body.attachments && req.body.attachments.length > 10) return res.status(400).json(new Reply(400, false, {message: "You can only attach 10 files per message"}));
        let canWrite = await isPermittedToWrite(req.params.id, res.locals.user._id);
        if (!canWrite) return res.status(403).json(new ForbiddenReply("You do not have permission to send messages to this channel"));
        let Message = db.getMessages();
        let ua = req.headers['lq-agent'];
        if (!ua) ua = "Unknown";

        const postMessage = (attachments?: string[]) => {
            let message = new Message({
                _id: new mongoose.Types.ObjectId(),
                channelId: req.params.id,
                authorId: res.locals.user._id,
                content: req.body.content ? req.body.content.trim() : "",
                ua: String(ua),
                timestamp: Date.now(),
                attachments: attachments || []
            })
            message.save((err) => {
                if (err) throw err;
                res.json(new Reply(200, true, {message}));
                // Send create event
                let author = {
                    _id: res.locals.user._id,
                    username: res.locals.user.username,
                    avatarUri: res.locals.user.avatar
                }
                let data = {
                    eventId: "messageCreate",
                    message: message,
                    author: author
                }
                subscriptionListener.emit("event", `channel_${message.channelId}` , data);
            })
        }

        // Process attachments
        if (req.body.attachments && req.body.attachments.length > 0) {
            // Upload files to cloud
            let formData = new FormData();
            let files : string[] = [];
            let s = false; // If an error occurs, this will be set to true
            // Loop through each attachment
            for (const attachment of req.body.attachments) {
                if (s) break;
                // Turn base64 string into buffer
                let fileBuffer = Buffer.from(attachment, "base64");
                if (fileBuffer.length > 26214400) return s = true;
                // Get file type
                let fileType : FileTypeResult | undefined | { ext: string, mime: string } = await fileTypeFromBuffer(fileBuffer);
                if (!fileType) fileType = { ext: "txt", mime: "application/octet-stream" };
                // Save temporary file to disk
                let randomName = `${Math.floor(Math.random() * 1000000)}.${fileType.ext}`;
                fs.writeFileSync(`/share/wcloud/${randomName}`, fileBuffer);
                formData.append(`${Math.floor(Math.random() * 1000000)}`, fs.createReadStream(`/share/wcloud/${randomName}`));
                files.push(randomName);
            }
            if (s) return res.status(413).json(new Reply(413, false, {message: "One or more attachments are too large. Max size is 25MB", cat: "https://http.cat/413"}));
            // Actually upload files
            formData.submit({host: "upload.wanderers.cloud", headers: {authentication: process.env.WC_TOKEN}}, (err, response) => {
                if (err) return res.json(new ServerErrorReply());
                response.resume()
                response.once("data", (data) => {
                    try {
                        let dataString = data.toString().trim();
                        if (files.length === 1) postMessage([dataString]) // If there is only one file, only the url is returned
                        else postMessage(JSON.parse(dataString)); // If there are multiple files, an array of urls is returned
                    } catch (e) {
                        console.error(e);
                        return res.json(new ServerErrorReply());
                    }
                })
                response.once("end", () => {
                    files.forEach((file) => {
                        fs.unlinkSync(`/share/wcloud/${file}`);
                    })
                })
            })
        } else {
            postMessage();
        }
    } catch (e) {
        console.error(e);
        return res.status(500).json(new ServerErrorReply());
    }

})

/**
 * Delete a message
 */
router.delete("/:id/messages/:messageId", Auth, (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a channel id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid channel id"));
    if (!req.params.messageId) return res.status(400).json(new InvalidReplyMessage("Provide a message id"));
    if (!mongoose.isValidObjectId(req.params.messageId)) return res.status(400).json(new InvalidReplyMessage("Invalid message id"));

    // Find message
    let Messages = db.getMessages();
    Messages.findOne({ _id: req.params.messageId, channelId: req.params.id }, (err, message) => {
        if (err) {
            console.error(err);
            return res.status(500).json(new ServerErrorReply());
        }
        if (!message) return res.status(404).json(new NotFoundReply("Message not found"));
        // Does author match
        if (message.authorId.toString() !== res.locals.user._id.toString()) return res.status(403).json(new ForbiddenReply("You do not have permission to delete this message"));
        // Send pipe bomb
        Messages.deleteOne({ _id: req.params.messageId }, (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json(new ServerErrorReply());
            }
            const done = () => {
                res.json(new Reply(200, true, {message: "Message deleted"}));
                // Send delete event
                let data = {
                    eventId: "messageDelete",
                    message: message
                }
                subscriptionListener.emit("event", `channel_${message.channelId}` , data);
            }
            // Delete attachments
            if (message.attachments.length === 0) return done();
            done();
            message.attachments.forEach((attachment) => {
                axios.delete(`https://wanderers.cloud/file/${attachment.split("file/")[1].split(".")[0]}`, {headers: {authentication: process.env.WC_TOKEN}})
                    .catch((e) => {
                        // This is internal cleanup, so we don't need to tell the user if something goes wrong
                        console.error(e);
                    });
            })
        })
    })
})

/**
 * Edit a message
 */
router.patch("/:id/messages/:messageId", Auth, (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a channel id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid channel id"));
    if (!req.params.messageId) return res.status(400).json(new InvalidReplyMessage("Provide a message id"));
    if (!mongoose.isValidObjectId(req.params.messageId)) return res.status(400).json(new InvalidReplyMessage("Invalid message id"));
    if (!req.body.content) return res.status(400).json(new InvalidReplyMessage("Provide a message content"));
    if (req.body.content.trim().length > 2000) return res.status(400).json(new InvalidReplyMessage("Message content must be less than 2000 characters"));
    if (req.body.attachments) return res.status(501).json(new Reply(501, false, { message: "Attachments cannot be edited yet" }));
    // Find message
    let Messages = db.getMessages();
    Messages.findOne({ _id: req.params.messageId, channelId: req.params.id }, (err, message) => {
        if (err) {
            console.error(err);
            return res.status(500).json(new ServerErrorReply());
        }
        if (!message) return res.status(404).json(new NotFoundReply("Message not found"));
        // Does author match
        if (message.authorId.toString() !== res.locals.user._id.toString()) return res.status(403).json(new ForbiddenReply("You do not have permission to edit this message"));
        // Send pipe bomb
        message.content = req.body.content.trim();
        message.edited = true;
        message.save((err) => {
            if (err) {
                console.error(err);
                return res.status(500).json(new ServerErrorReply());
            }
            // Return success
            res.json(new Reply(200, true, {message}));
            // Send edit event
            let data = {
                eventId: "messageUpdate",
                message: message
            }
            subscriptionListener.emit("event", `channel_${message.channelId}` , data);
        })
    })
})

/**
 * Check if a user has permission to read a channel
 * @param channelId
 * @param userId
 */
const isPermittedToRead = (channelId, userId) => {
    return new Promise((resolve, reject) => {
        let Quarks = db.getQuarks();
        Quarks.findOne({ members: userId, channels: new mongoose.Types.ObjectId(channelId) }, (err, quark) => {
            if (err) return reject(err);
            // DO NOT CONSOLE.LOG THIS
            resolve(!!quark);
        });
    })
}

/**
 * Check if a user has permission to send messages to a channel
 * @param channelId
 * @param userId
 */
const isPermittedToWrite = (channelId, userId) => {
    return new Promise((resolve, reject) => {
        let Quarks = db.getQuarks();
        Quarks.findOne({ members: userId, channels: new mongoose.Types.ObjectId(channelId) }, (err, quark) => {
            if (err) return reject(err);
            resolve(!!quark);
        });
    })
}

const getUser = async (userId) => {
    let Users = db.getLoginUsers();
    let user = await Users.findOne({ _id: userId });
    if (!user) return null;
    let Avatars = db.getAvatars();
    let avatar = await Avatars.findOne({ userId: user._id });
    let avatarUri = avatar ? avatar.avatarUri : null;
    if (!avatarUri) avatarUri = `https://auth.litdevs.org/api/avatar/bg/${user._id}`;
    return {
        _id: user._id,
        username: user.username,
        avatar: avatarUri
    };
}

export { isPermittedToRead, isPermittedToWrite };
export default router;