import express from 'express';
import Reply from "../../classes/reply/Reply.js";
import { Auth } from './auth.js';
import db from "../../db.js";
import * as mongoose from "mongoose";
import ServerErrorReply from "../../classes/reply/ServerErrorReply.js";
import InvalidReplyMessage from "../../classes/reply/InvalidReplyMessage.js";
import {isValidObjectId} from "mongoose";
import NotFoundReply from "../../classes/reply/NotFoundReply.js";
import ForbiddenReply from "../../classes/reply/ForbiddenReply.js";
import fs, {write} from "fs";
import FormData from "form-data";
import axios from "axios";
import {subscriptionListener} from "../v1/gateway.js";
import path from "path";
import {getNick, getNickBulk} from "../../util/getNickname.js";
import P, {
    checkPermittedChannelResponse,
    checkPermittedQuarkResponse
} from "../../util/PermissionMiddleware.js";
import RequiredProperties from "../../util/RequiredProperties.js";
import {ConstantID_DMvQuark, ConstantID_SystemUser} from "../../util/ConstantID.js";
import {networkInformation} from "../../index.js";
import {plainStatus} from "./user/status.js";

const router = express.Router();

/**
 * Get channel by id
 */
router.get("/:id", Auth, P("READ_CHANNEL", "channel"), async (req, res) => {
    let Channels = db.getChannels();
    try {
        let channel = await Channels.findOne({ _id: req.params.id });
        if (!channel) return res.status(404).json(new NotFoundReply("Channel not found"));
        res.json(new Reply(200, true, {message: "Here is the channel", channel }));
    } catch (err) {
        console.error(err);
        return res.status(500).json(new ServerErrorReply());
    }
})

/**
 * Delete a channel by id
 */
router.delete("/:id", Auth, P("DELETE_CHANNEL", "channel"), async (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a channel id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid channel id"));
    let Channels = db.getChannels();
    try {
        let channel = await Channels.findOne({ _id: req.params.id });
        if (!channel) return res.reply(new NotFoundReply("Channel not found"));
        let Quarks = db.getQuarks();
        let quark = await Quarks.findOne({ _id: channel.quark, channels: channel._id});
        if (ConstantID_DMvQuark.equals(channel.quark)) {
            quark = {
                name: "Direct Messages",
                _id: ConstantID_DMvQuark,
                members: [res.locals.user._id],
                invite: "direct messages", // Impossible invite
                owners: [ ConstantID_SystemUser ],
                channels: [channel._id] // TODO: #LIGHTQUARK-1
            }
        }
        if (!quark) return res.reply(new NotFoundReply("Quark not found"));
        // Remove channel from quark
        // TODO: Stop doing this, #LIGHTQUARK-45
        quark.channels.splice(quark.channels.indexOf(channel._id), 1);
        // Delete channel
        await Channels.deleteOne({ _id: channel._id });
        // Save quark
        await quark.save();
        // Return success
        res.json(new Reply(200, true, {message: "Channel deleted"}));

        // Send delete event
        let data = {
            eventId: "channelDelete",
            channel: channel,
            quark: quark
        }
        subscriptionListener.emit("event", `quark_${channel.quark}` , data);
    } catch (err) {
        console.error(err);
        return res.status(500).json(new ServerErrorReply());
    }
})


/**
 * Edit a channel by id
 */
router.patch("/:id", Auth, async (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a channel id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid channel id"));
    if (!req.body.name && !req.body.description) return res.reply(new Reply(200, true, {message: "Nothing to update"}));
    let Channels = db.getChannels();
    try {
        let channel = await Channels.findOne({ _id: req.params.id });
        if (!channel) return res.status(404).json(new NotFoundReply("Channel not found"));
        let Quarks = db.getQuarks();
        let quark = await Quarks.findOne({ _id: channel.quark, channels: channel._id });
        if (ConstantID_DMvQuark.equals(channel.quark)) {
            quark = {
                name: "Direct Messages",
                _id: ConstantID_DMvQuark,
                members: [res.locals.user._id],
                invite: "direct messages", // Impossible invite
                owners: [ ConstantID_SystemUser ],
                channels: [channel._id] // TODO: #LIGHTQUARK-1
            }
        }

        // Update name
        if (req.body.name && !(await checkPermittedChannelResponse("EDIT_CHANNEL_NAME", channel._id, res.locals.user._id, res, quark._id))) {
            return;
        }
        if (req.body.name) {
            if (req.body.name.length > 64) return res.status(400).json(new Reply(400, false, {message: "Name must be less than 64 characters"}));
            channel.name = req.body.name.trim();
        }
        // Update description
        if (req.body.description && !(await checkPermittedChannelResponse("EDIT_CHANNEL_DESCRIPTION", channel._id, res.locals.user._id, res, quark._id))) {
            return;
        }
        if (typeof req.body.description !== "undefined") {
            channel.description = String(req.body.description).trim();
        }
        // Save the channel
        await channel.save();
        res.json(new Reply(200, true, {message: "Channel updated", channel}));
        // Send update event
        let data = {
            eventId: "channelUpdate",
            channel: channel,
            quark: quark
        }
        subscriptionListener.emit("event", `quark_${channel.quark}` , data);
    } catch (err) {
        console.error(err);
        return res.status(500).json(new ServerErrorReply());
    }
})

/**
 * Create a channel
 */
router.post("/create", Auth, async (req, res) => {
    if (!req.body.quark) return res.status(400).json(new InvalidReplyMessage("Provide a quark id"));
    if (req.body.quark === "dm") req.body.quark = ConstantID_DMvQuark;
    if (!mongoose.isValidObjectId(req.body.quark)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    if (!req.body.name) return res.status(400).json(new InvalidReplyMessage("Provide a channel name"));
    if (req.body.name.trim().length > 64) return res.status(400).json(new Reply(400, false, {message: "Name must be less than 64 characters"}));
    const isDM = ConstantID_DMvQuark.equals(req.body.quark);
    if (isDM && (!req.body.members || !Array.isArray(req.body.members))) return res.reply(new InvalidReplyMessage("Invalid list of DM members"))
    if (isDM && !req.body.members.includes(String(res.locals.user._id))) req.body.members.push(res.locals.user._id);
    if (isDM) {
        const invalid = req.body.members.some(member => typeof member !== "string" || !isValidObjectId(member))
        if (invalid) return res.reply(new InvalidReplyMessage("Invalid list of DM members"));
    }
    let Quarks = db.getQuarks();
    try {
        let quark = !isDM ? await Quarks.findOne({ _id: req.body.quark }) : {
            name: "Direct Messages",
            _id: ConstantID_DMvQuark,
            members: [res.locals.user._id],
            invite: "direct messages", // Impossible invite
            owners: [ ConstantID_SystemUser ],
            channels: []
        };
        if (!quark) return res.status(404).json(new NotFoundReply("Quark not found"));
        let check = isDM || await checkPermittedQuarkResponse(["CREATE_CHANNEL"], quark._id, res.locals.user._id, res);
        if (!check) return;
        let Channel = db.getChannels();
        let channel = new Channel({
            _id: new mongoose.Types.ObjectId(),
            name: req.body.name.trim(),
            description: req.body.description ? String(req.body.description).trim() : "",
            quark: quark._id
        });
        if (!isDM) {
            await channel.save();
            quark.channels.push(channel._id);
            await quark.save();
            res.json(new Reply(200, true, {message: "Channel created", channel}));
            // Send create event
            let data = {
                eventId: "channelCreate",
                channel: channel,
                quark: quark
            }
            subscriptionListener.emit("event", `quark_${channel.quark}` , data);
        } else {
            // TODO: Privacy system (dont let anyone dm you)
            let users = await getUserBulk(req.body.members, ConstantID_DMvQuark)
            /*
            The way im doing it is a bit hacky, but here goes:
            dm quark is a fictional concept, it has the id of 0 and is handled by the endpoints rather than being in the db (why??)
            Dm quark has permissions set up to deny anyone from viewing channels

            To make a dm/group:
            1. Create channel with quark set to the dm quark id (0)
            2. Create a new role for that channel (yes every dm gets a role, yikes)
            3. Create permission assignment for EDIT_CHANNEL permission for that role
            4. Create role assignments for each dm member for that role in dm quark
            5. Win
             */
            // 1.
            await channel.save();
            // 2.
            let Role = db.getRoles()
            let dmRole = new Role({
                _id: new mongoose.Types.ObjectId(),
                name: channel._id.toString(),
                description: "DM Channel permissions",
                createdBy: ConstantID_SystemUser,
                priority: 1,
                isDefault: false
            })
            await dmRole.save();
            // 3.
            let PermissionAssignment = db.getPermissionAssignments();
            let dmPerm = new PermissionAssignment({
                _id: new mongoose.Types.ObjectId(),
                role: dmRole._id,
                permission: "EDIT_CHANNEL", // Grants read and allows changing description and name
                type: "allow",
                scopeType: "channel",
                scopeId: channel._id // Scope this permission to the newly created dm channel
            })
            await dmPerm.save()
            // 4.
            let RoleAssignment = db.getRoleAssignments();
            for (const user of users) {
                let roleAssignment = new RoleAssignment({
                    _id: new mongoose.Types.ObjectId(),
                    role: dmRole._id,
                    user: user._id,
                    quark: ConstantID_DMvQuark
                })
                await roleAssignment.save();
            }

            // 5.
            // Win
            res.json(new Reply(200, true, {message: "Channel created", channel}));
            // Send create event
            let data = {
                eventId: "channelCreate",
                channel: channel,
                quark: quark
            }
            subscriptionListener.emit("event", `quark_${channel.quark}` , data);
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json(new ServerErrorReply());
    }
})

router.get("/:id/messages", Auth, P(["READ_CHANNEL_HISTORY", "READ_CHANNEL"], "channel"), async (req, res) => {
    //console.time("getMessages")
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a channel id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid channel id"));

    try {
        let messages = db.getMessages();
        // Optionally client can provide a timestamp to get messages before or after
        let startTimestamp = Infinity;
        let endTimestamp = 0;
        if (req.query.startTimestamp) startTimestamp = Number(req.query.startTimestamp)
        if (req.query.endTimestamp) endTimestamp = Number(req.query.endTimestamp)
        if (isNaN(startTimestamp)) return res.status(400).json(new InvalidReplyMessage("Invalid startTimestamp"));
        if (isNaN(endTimestamp)) return res.status(400).json(new InvalidReplyMessage("Invalid endTimestamp"));

        let Quark = db.getQuarks();
        let quark = await Quark.findOne({ channels: new mongoose.Types.ObjectId(req.params.id) });

        // Find messages in specified range, if endTimestamp is specified get messages after that timestamp, otherwise get messages before that timestamp
        // The naming is a bit backwards, isn't it?
        let query = messages.find({ channelId: req.params.id, timestamp: { $lt: startTimestamp, $gt: endTimestamp } }).sort({ timestamp: endTimestamp === 0 ? -1 : 1 });
        query.limit(50);
        query.then(async (messages) => {
            let authorIds = messages.map(m => m.authorId);
            let authors = await getUserBulk(authorIds, quark?._id);
            for (let i = 0; i < messages.length; i++) {
                let author = authors.find(a => String(a._id) === String(messages[i].authorId));
                messages[i] = { message: messages[i], author };
            }
            //console.timeEnd("getMessages")
            res.json(new Reply(200, true, {message: "Here are the messages", messages}));
        })
    } catch (e) {
        console.error(e);
        return res.status(500).json(new ServerErrorReply());
    }
})

router.get("/:id/messages/:messageId", Auth, P(["READ_CHANNEL_HISTORY", "READ_CHANNEL"], "channel"), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.messageId)) return res.status(400).json(new InvalidReplyMessage("Invalid message id"));

    try {
        let messages = db.getMessages();

        let Quark = db.getQuarks();
        let quark = await Quark.findOne({ channels: new mongoose.Types.ObjectId(req.params.id) });

        let message = await messages.findOne({ channelId: req.params.id, _id: req.params.messageId });
        if (!message) return res.status(404).json(new NotFoundReply("Message not found"));
        message = { message: message, author: await getUser(message.authorId, quark?._id) };
        res.json(new Reply(200, true, {message: "Here is the message", data: message}));
    } catch (e) {
        console.error(e);
        return res.status(500).json(new ServerErrorReply());
    }
})

// TODO: USE_EXTERNAL_EMOJI
router.post("/:id/messages", Auth, P("WRITE_MESSAGE", "channel"), RequiredProperties([
    {
        property: "content",
        type: "string",
        maxLength: 10000,
        trim: true
    },
    {
        property: "attachments",
        isArray: true,
        maxLength: 10,
        optional: true
    }
]), async (req, res) => {
    try {
        if (req.body.content.trim().length === 0 && (!req.body.attachments || req.body.attachments.length === 0)) return res.status(400).json(new InvalidReplyMessage("Provide a message content"));

        let Message = db.getMessages();
        let ua = req.headers['lq-agent'];
        if (!ua) ua = "Unknown";

        let Quark = db.getQuarks();
        let quark = await Quark.findOne({ channels: new mongoose.Types.ObjectId(req.params.id) });

        if (req.body.attachments && req.body.attachments.length > 0 && !(await checkPermittedChannelResponse("WRITE_ATTACHMENT", req.params.id, res.locals.user._id, res, quark?._id))) {
            return;
        }

        const attributeCheck = async () => {
            if (req.body.specialAttributes) {
                let attributeAllowArray = await Promise.all(req.body.specialAttributes.map(async (attribute) => {
                    let allAllowed = [
                        "/me",
                        "botMessage",
                        "reply",
                        "clientAttributes"
                    ]
                    let defaultAllowed = [
                        "/me",
                        "clientAttributes"
                    ]

                    // Clean up plaintext
                    if (attribute.type === "clientAttributes") {
                        if (attribute.plaintext) {
                            attribute.plaintext = attribute.plaintext.trim().substring(0, 10000);
                        }
                    }

                    if (typeof attribute !== "object" || !attribute.type) return false;
                    if (!allAllowed.includes(attribute.type)) return false;
                    if (defaultAllowed.includes(attribute.type)) return true;

                    if (attribute.type === "botMessage") return !!res.locals.user.isBot;

                    if (attribute.type === "reply") {
                        try {
                            if (!attribute.replyTo || !isValidObjectId(attribute.replyTo)) return false;
                            let replyToMessage = await Message.findOne({ _id: attribute.replyTo, channelId: req.params.id})
                            return !!replyToMessage;
                        } catch (e) {
                            console.error(e);
                            return false;
                        }
                    }

                }))
                return !attributeAllowArray.includes(false)
            } else {
                return true;
            }
        }

        if (!(await attributeCheck())) return res.json(new InvalidReplyMessage("Invalid attributes."))

        const postMessage = async (attachments?: string[]) => {
            let message = new Message({
                _id: new mongoose.Types.ObjectId(),
                channelId: req.params.id,
                authorId: res.locals.user._id,
                content: req.body.content ? req.body.content.trim() : "",
                ua: String(ua),
                timestamp: Date.now(),
                attachments: attachments || [],
                specialAttributes: req.body.specialAttributes || []
            })
            await message.save();
            res.json(new Reply(200, true, {message}));
            // Send create event
            let author = {
                _id: res.locals.user._id,
                username: await getNick(res.locals.user._id, quark?._id),
                avatarUri: res.locals.user.avatar,
                admin: !!res.locals.user.admin,
                isBot: !!res.locals.user.isBot
            }
            let data = {
                eventId: "messageCreate",
                message: message,
                author: author
            }
            subscriptionListener.emit("event", `channel_${message.channelId}` , data);
        }

        // Process attachments
        if (req.body.attachments && req.body.attachments.length > 0) {
            // Upload files to cloud
            let formData = new FormData();
            let files : string[] = [];
            let s = false; // If an error occurs, one of these will be set to true
            let m = false;
            // Loop through each attachment
            for (const attachment of req.body.attachments) {
                if (typeof attachment !== "object") m = true;
                if (!attachment.filename || !attachment.data) m = true;
                if (s || m) break;
                // Turn base64 string into buffer
                let fileBuffer = Buffer.from(attachment.data, "base64");
                if (fileBuffer.length > 26214400) return s = true;
                // Save temporary file to disk
                let randomName = `${Math.floor(Math.random() * 1000000)}${path.extname(attachment.filename)}`;
                fs.writeFileSync(path.resolve(`./temp/${randomName}`), fileBuffer);
                formData.append(randomName, fs.createReadStream(path.resolve(`./temp/${randomName}`)), { filename: attachment.filename});
                files.push(randomName);
            }
            if (s) return res.status(413).json(new Reply(413, false, {message: "One or more attachments are too large. Max size is 25MB", cat: "https://http.cat/413"}));
            if (m) return res.status(400).json(new InvalidReplyMessage("One or more attachments are malformed. Make sure you provide the filename and data properties in each object"));
            // Actually upload files
            formData.submit({protocol: "https:", host: "upload.wanderers.cloud", headers: {authentication: process.env.WC_TOKEN}}, (err, response) => {
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
                        fs.unlinkSync(path.resolve(`./temp/${file}`));
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
router.delete("/:id/messages/:messageId", Auth, async (req, res) => {
    if (!req.params.messageId) return res.status(400).json(new InvalidReplyMessage("Provide a message id"));
    if (!mongoose.isValidObjectId(req.params.messageId)) return res.status(400).json(new InvalidReplyMessage("Invalid message ID"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid channel ID"));

    // Find message
    let Messages = db.getMessages();
    try {
        let message = await Messages.findOne({ _id: req.params.messageId, channelId: req.params.id });
        if (!message) return res.status(404).json(new NotFoundReply("Message not found"));

        // Author can always delete, but others can delete if they have DELETE_OTHER_MESSAGE
        if (String(res.locals.user._id) !== String(message.authorId)) {
            if (!(await checkPermittedChannelResponse("DELETE_OTHER_MESSAGE", req.params.id, res.locals.user._id, res))) return;
        }

        // Send pipe bomb
        await Messages.deleteOne({ _id: req.params.messageId });
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
                    // TODO: this should be a delete hook #LIGHTQUARK-40
                    console.error(e);
                });
        })
    } catch (err) {
        console.error(err);
        return res.status(500).json(new ServerErrorReply());
    }
})

/**
 * Edit a message
 */
router.patch("/:id/messages/:messageId", Auth, P("WRITE_MESSAGE", "channel"), RequiredProperties([
    {
        property: "content",
        type: "string",
        maxLength: 10000,
        trim: true,
        minLength: 1,
        optional: true
    },
    {
        property: "clientAttributes",
        optional: true,
        type: "object"
    }
]), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.messageId)) return res.status(400).json(new InvalidReplyMessage("Invalid message id"));

    // Find message
    let Messages = db.getMessages();
    try {
        let message = await Messages.findOne({ _id: req.params.messageId, channelId: req.params.id });
        if (!message) return res.status(404).json(new NotFoundReply("Message not found"));

        if (req.body.content) message.content = req.body.content.trim();
        if (req.body.clientAttributes) {
            if (!req.body.clientAttributes.type) req.body.clientAttributes.type = "clientAttributes";
            // Change existing array entry if it exists
            let index = message.specialAttributes?.findIndex((a) => a.type === "clientAttributes");
            if (!message?.specialAttributes) message.specialAttributes = [];
            if (index && index !== -1) message.specialAttributes[index] = req.body.clientAttributes;
            else message.specialAttributes.push(req.body.clientAttributes);
        }
        message.edited = true;
        await message.save();
        let Quark = db.getQuarks();
        let quark = await Quark.findOne({ channels: new mongoose.Types.ObjectId(req.params.id) });
        if (!quark) {
            let Channels = db.getChannels()
            let dmChannel = await Channels.findOne({quark: ConstantID_DMvQuark, _id: req.params.id})
            if (!dmChannel) return res.reply(new NotFoundReply())
            quark = {
                name: "Direct Messages",
                _id: ConstantID_DMvQuark,
                members: [res.locals.user._id],
                invite: "direct messages", // Impossible invite
                owners: [ ConstantID_SystemUser ],
                channels: [dmChannel._id] // TODO: #LIGHTQUARK-1
            }
        }

        let user = await getUser(message.authorId, quark._id)

        // Return success
        res.json(new Reply(200, true, {message, author: user}));

        // Send edit event
        let data = {
            eventId: "messageUpdate",
            message: message,
            author: user
        }
        subscriptionListener.emit("event", `channel_${message.channelId}` , data);
    } catch (err) {
        console.error(err);
        return res.status(500).json(new ServerErrorReply());
    }
})

const getUser = async (userId, quarkId) => {
    let Users = db.getLoginUsers();
    let user = await Users.findOne({ _id: userId });
    if (!user) return null;
    let Avatars = db.getAvatars();
    let avatar = await Avatars.findOne({ userId: user._id });
    let avatarUri = avatar ? avatar.avatarUri : null;
    if (!avatarUri) avatarUri = `https://auth.litdevs.org/api/avatar/bg/${user._id}`;
    return {
        _id: user._id,
        username: await getNick(user._id, quarkId),
        avatarUri: avatarUri,
        admin: !!user.admin
    };
}

export const getUserBulk = async (userIds, quarkId) => {
    let Users = db.getLoginUsers();
    let users = await Users.find({ _id: {$in: userIds} });
    if (!users) return null;
    let Avatars = db.getAvatars();
    let avatars = await Avatars.find({ userId: {$in: userIds} });

    let Statuses = db.getStatuses();
    let statuses = await Statuses.find({userId: {$in: userIds} });

    let nicks = await getNickBulk(userIds, quarkId);

    users.forEach((user, index) => {
        let avatar = avatars.find(a => String(a.userId) === String(user._id));
        let status = statuses.find(a => String(a.userId) === String(user._id));
        let avatarUri = avatar ? avatar.avatarUri : null;
        if (!avatarUri) avatarUri = `https://auth.litdevs.org/api/avatar/bg/${user._id}`;
        user.avatarUri = avatarUri;

        users[index] = {
            _id: user._id,
            username: nicks.find(n => String(n.userId) === String(user._id))?.nickname || user.username, // Fallback to username if nickname is not set
            avatarUri: avatarUri,
            status: plainStatus(status) || undefined,
            admin: !!user.admin,
            isBot: !!user.isBot
        }
    })

    // Add system user, because it's not in the database
    if (userIds.some(user => String(user) === String(ConstantID_SystemUser))) {
        let status = statuses.find(a => String(a.userId) === String(ConstantID_SystemUser));
        users.push({
            _id: ConstantID_SystemUser,
            username: "System",
            admin: true,
            avatarUri: `${networkInformation.baseUrl}/systemUser.webp`,
            isBot: false,
            status: plainStatus(status)
        })
    }

    return users;
}

export default router;
