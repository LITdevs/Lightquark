import express from 'express';
import Reply from "../../classes/reply/Reply.js";
import {Auth} from './auth.js';
import db from "../../db.js";
import * as mongoose from "mongoose";
import ServerErrorReply from "../../classes/reply/ServerErrorReply.js";
import InvalidReplyMessage from "../../classes/reply/InvalidReplyMessage.js";
import NotFoundReply from "../../classes/reply/NotFoundReply.js";
import {isUint8Array} from "util/types";
import {fileTypeFromBuffer, FileTypeResult} from "file-type";
import FormData from "form-data";
import fs from "fs";
import axios from "axios";
import {subscriptionListener} from "../v1/gateway.js";
import RequiredProperties from "../../util/RequiredProperties.js";
import sharp from "sharp";

const router = express.Router();

/**
 * Get servers that the user is a member of.
 * Servers are called Quarks.
 */
router.get("/me", Auth, async (req, res) => {
    let Quarks = db.getQuarks();
    try {
        let quarks = await Quarks.find({ members: res.locals.user._id});
        let Channels = db.getChannels();
        const resolveChannels = async (quarkChannels, quarkId) => {
            let channels = await Channels.find({ quark: quarkId })
            let newChannels = await Promise.all(quarkChannels.map((channel) => {
                let foundChannel = channels.find((c) => c._id.toString() === channel.toString());
                if (foundChannel) channel = foundChannel;
                return channel;
            }))
            return newChannels;
        }

        quarks = await Promise.all(quarks.map(async (quark) => {
            let inflatedChannels = await resolveChannels(quark.channels, quark._id);
            quark.channels = inflatedChannels;
            return quark;
        }))

        res.json(new Reply(200, true, {message: "Here are the quarks you are a member of", quarks}));
    } catch (err) {
        console.error(err);
        res.status(500).json(new ServerErrorReply());
    }
});


/**
 * Change quark order
 * @param {string[]} order - The new order of the quarks
 */
router.put("/order", Auth, async (req, res) => {
    try {
        if (!req.body.order) return res.status(400).json(new InvalidReplyMessage("Provide an order"));
        let Quarks = db.getQuarks();
        let quarkIds = (await Quarks.find({members: res.locals.user._id})).map((quark) => quark._id.toString());

        // Make sure all quarks are in the order
        if (req.body.order.length !== quarkIds.length) return res.status(400).json(new InvalidReplyMessage("Invalid order"));
        for(let i = 0; i < quarkIds.length; i++) {
            if (!req.body.order.includes(quarkIds[i])) return res.status(400).json(new InvalidReplyMessage("Invalid order"));
        }

        // Update the order
        let QuarkOrder = db.getQuarkOrders();
        await QuarkOrder.updateOne({userId: res.locals.user._id}, {order: req.body.order}, {upsert: true});

        res.json(new Reply(200, true, {message: "Quark order updated"}));

        // Send update event
        let data = {
            eventId: "quarkOrderUpdate",
            order: req.body.order,
            userId: res.locals.user._id
        }
        subscriptionListener.emit("event", `me`, data);


    } catch (e) {
        console.error(e);
        return res.status(500).json(new ServerErrorReply());
    }
})

/**
 * Get quark order
 */
router.get("/order", Auth, async (req, res) => {
    try {
        let QuarkOrder = db.getQuarkOrders();
        let order = await QuarkOrder.findOne({userId: res.locals.user._id});
        if (!order) {
            order = new QuarkOrder({
                userId: res.locals.user._id,
                order: [],
                _id: new mongoose.Types.ObjectId()
            })

            let Quarks = db.getQuarks();
            let quarks = await Quarks.find({members: res.locals.user._id});
            order.order = quarks.map((quark) => quark._id.toString());

            await order.save();
        } else {
            let Quarks = db.getQuarks();
            let quarks = await Quarks.find({members: res.locals.user._id});

            quarks.forEach(quark => {
                if (!order.order.includes(quark._id.toString())) {
                    order.order.push(quark._id.toString());
                }
            })
            order.order.forEach(quarkId => {
                if (!quarks.find((quark) => quark._id.toString() === quarkId)) {
                    order.order.splice(order.order.indexOf(quarkId), 1);
                }
            })
            await order.save();

        }

        res.json(new Reply(200, true, {order: order.order}));
    } catch (e) {
        console.error(e);
        return res.status(500).json(new ServerErrorReply());
    }
})

/**
 * Create a new quark
 * @param name The name of the quark
 */
router.post("/create", Auth, async (req, res) => {
    if (!req.body.name || !req.body.name.trim()) return res.json(new Reply(400, false, {message: "Name is required"}));
    if (req.body.name.length > 64) return res.json(new Reply(400, false, {message: "Name must be less than 64 characters"}));
    let Quark = db.getQuarks();
    try {
        let defaultChannelId = new mongoose.Types.ObjectId();
        let quarkId = new mongoose.Types.ObjectId();
        let newQuark = new Quark({
            _id: quarkId,
            members: [res.locals.user._id], // Add the user to the quark
            name: req.body.name.trim(), // Trim the name to remove any whitespace
            iconUri: "https://lq.litdevs.org/default.webp", // Use default icon
            emotes: [],
            roles: [],
            bans: [],
            channels: [defaultChannelId], // Add the default channel
            invite: `${req.body.name.replace(/[^A-Za-z0-9-_.]/g, "-").toLowerCase()}-${Math.floor(Math.random() * 1000000)}`, // Generate random invite code
            owners: [res.locals.user._id] // Add the user to the owners
        });

        await newQuark.save()
        let Channel = db.getChannels();
        let newChannel = new Channel({
            _id: defaultChannelId,
            name: "general",
            quark: newQuark._id,
            description: "The default channel"
        })
        await newChannel.save();

        res.json(new Reply(200, true, {message: "Quark created", quark: newQuark}));
    } catch (err) {
        console.error(err);
        return res.status(500).json(new ServerErrorReply());
    }
})

router.post("/:id/leave", Auth, async (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a quark id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    let Quark = db.getQuarks();
    try {
        let quark = await Quark.findOne({_id: req.params.id, members: res.locals.user._id});
        if (!quark) return res.status(404).json(new NotFoundReply("Quark not found"));
        if (quark.owners.includes(res.locals.user._id)) return res.status(400).json(new Reply(400, false, {message: "You cannot leave a quark you own"}));
        quark.members = quark.members.filter((member) => member.toString() !== res.locals.user._id.toString());
        await quark.save()
        res.json(new Reply(200, true, {message: "You have left the quark"}));
        // Send leave event
        let data = {
            eventId: "memberLeave",
            quark: quark,
            user: { _id: res.locals.user._id, username: res.locals.user.username, avatarUri: res.locals.user.avatar }
        }
        subscriptionListener.emit("event", `quark_${quark._id}` , data);
    } catch (err) {
        console.error(err);
        return res.status(500).json(new ServerErrorReply());
    }
})

/**
 * Respond 400 if no quark id is provided
 */
router.all("/", Auth, (req, res) => {
    res.status(400).json(new InvalidReplyMessage("Provide a quark id"));
})

/**
 * Delete a quark by id
 */
router.delete("/:id", Auth, async (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a quark id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    let Quarks = db.getQuarks();
    try {
        let quark = await Quarks.findOne({ _id: req.params.id, owners: res.locals.user._id });
        if (!quark) return res.status(404).json(new NotFoundReply("Quark not found, or you are not an owner"));
        await Quarks.deleteOne({ _id: quark._id, owners: res.locals.user._id })
        res.json(new Reply(200, true, {message: "Quark deleted"}));
        // Send delete event
        let data = {
            eventId: "quarkDelete",
            quark: quark
        }
        subscriptionListener.emit("event", `quark_${quark._id}` , data);
    } catch (err) {
        console.error(err);
        return res.status(500).json(new ServerErrorReply());
    }
})

/**
 * Get a quark by id
 */
router.get("/:id", Auth, async (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a quark id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    let Quarks = db.getQuarks();
    try {
        let quark = await Quarks.findOne({ _id: req.params.id });
        if (!quark) return res.status(404).json(new NotFoundReply("Quark not found"));
        let Channels = db.getChannels();
        let channels = await Channels.find({ quark: quark._id });
        quark.channels = quark.channels.map((channel) => {
            let foundChannel = channels.find((c) => c._id.toString() === channel.toString());
            if (foundChannel) channel = foundChannel;
            return channel;
        })
        res.json(new Reply(200, true, {message: "Here is the quark", quark}));
    } catch (err) {
        console.error(err);
        return res.status(500).json(new ServerErrorReply());
    }
})

/**
 * Get a quark by invite
 */
router.get("/invite/:invite", async (req, res) => {
    if (!req.params.invite) return res.status(400).json(new InvalidReplyMessage("Invalid invite"));
    let Quarks = db.getQuarks();
    try {
        let inviteQuark = await Quarks.findOne({ invite: req.params.invite })
        if (!inviteQuark) return res.status(404).json(new NotFoundReply("Invalid invite"));
        res.json(new Reply(200, true, {message: "Invite valid!", quark: inviteQuark}));
    } catch (err) {
        console.error(err);
        return res.status(500).json(new ServerErrorReply());
    }
})

/**
 * Join a quark by invite
 */
router.post("/invite/:invite", Auth, async (req, res) => {
    if (!req.params.invite) return res.status(400).json(new InvalidReplyMessage("Invalid invite"));
    let Quarks = db.getQuarks();
    try {
        let inviteQuark = await Quarks.findOne({ invite: req.params.invite })
        if (!inviteQuark) return res.status(404).json(new NotFoundReply("Invalid invite"));
        if (inviteQuark.members.includes(res.locals.user._id)) return res.status(400).json(new InvalidReplyMessage("You are already a member of this quark"));
        inviteQuark.members.push(res.locals.user._id);
        await inviteQuark.save();
        res.json(new Reply(200, true, {message: "Joined quark", quark: inviteQuark}));

        // Send update event
        let data = {
            eventId: "memberJoin",
            quark: inviteQuark,
            user: { _id: res.locals.user._id, username: res.locals.user.username, avatarUri: res.locals.user.avatar }
        }
        subscriptionListener.emit("event", `quark_${inviteQuark._id}` , data);
    } catch (err) {
        console.error(err);
        return res.status(500).json(new ServerErrorReply());
    }
})

/**
 * Upload a quark icon
 */
router.put("/:id/icon", Auth, async (req, res) => {
    // Validate the quark id
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a quark id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    // Validate the request body
    if (!req.body || !isUint8Array(req.body)) return res.json(new Reply(400, false, {message: "Request body must be an image file in binary form"}));
    let fileType : FileTypeResult | undefined = await fileTypeFromBuffer(req.body);
    if (!fileType) return res.json(new Reply(400, false, {message: "Request body must be an image file in binary form"}));

    let randomName = `${Math.floor(Math.random() * 1000000)}.${fileType.ext}`;
    let Quarks = db.getQuarks();

    try {
        let quark = await Quarks.findOne({ _id: req.params.id, owners: res.locals.user._id });
        if (!quark) return res.status(404).json(new NotFoundReply("Quark not found, or you are not an owner"));
        let formData = new FormData();
        // Write temp file
        fs.writeFileSync(`/share/wcloud/${randomName}`, req.body);
        formData.append("upload", fs.createReadStream(`/share/wcloud/${randomName}`));
        // Upload to Wanderer's Cloud
        formData.submit({host: "upload.wanderers.cloud", headers: {authentication: process.env.WC_TOKEN}}, (err, response) => {
            if (err) return res.json(new ServerErrorReply());
            response.resume()
            response.once("data", async (data) => {
                let dataString = data.toString().trim();
                quark.iconUri = dataString;
                // Save changes
                await quark.save()
                res.json(new Reply(200, true, {message: "Quark icon has been updated", icon: dataString}));
                // Send update event
                let eventData = {
                    eventId: "quarkUpdate",
                    quark: quark
                }
                subscriptionListener.emit("event", `quark_${quark._id}` , eventData);
            })
            response.once("end", () => {
                if (!fileType) return;
                // Delete temp file
                fs.unlinkSync(`/share/wcloud/${randomName}`);
            })
        })
    } catch (err) {
        console.error(err);
        return res.json(new ServerErrorReply());
    }
})


/**
 * Reset the quark icon to the default icon.
 */
router.delete("/:id/icon", Auth, async (req, res) => {
    // Validate the quark id
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a quark id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));

    // Find the quark and reset the icon
    let Quarks = db.getQuarks();
    try {
        let quark = await Quarks.findOne({_id: req.params.id, owners: res.locals.user._id});
        if (!quark) return res.status(404).json(new InvalidReplyMessage("Quark not found or you are not an owner"));
        let oldIcon = quark.iconUri;
        if (quark.iconUri === "https://lq.litdevs.org/default.webp") return res.status(400).json(new InvalidReplyMessage("Quark already has the default icon"));
        quark.iconUri = "https://lq.litdevs.org/default.webp"; // Default icon
        await quark.save()
        axios.delete(`https://wanderers.cloud/file/${oldIcon.split("file/")[1].split(".")[0]}`, {headers: {authentication: process.env.WC_TOKEN}}).then((response) => {
            res.json(new Reply(200, true, {message: "Quark icon has been reset", icon: "https://lq.litdevs.org/default.webp"}));

            // Send update event
            let data = {
                eventId: "quarkUpdate",
                quark: quark
            }
            subscriptionListener.emit("event", `quark_${quark._id}` , data);
        })
    } catch (err) {
        console.error(err);
        return res.json(new ServerErrorReply());
    }
})

/**
 * Edit a quark by id
 */
// TODO: Allow roles to edit quarks
router.patch("/:id", Auth, async (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a quark id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    let Quarks = db.getQuarks();
    try {
        let quark = await Quarks.findOne({ _id: req.params.id });
        if (!quark) return res.status(404).json(new NotFoundReply("Quark not found"));
        if (!quark.owners.includes(res.locals.user._id)) return res.status(403).json(new Reply(403, false, {message: "You are not an owner of this quark"}));
        // Update name
        if (req.body.name) {
            if (req.body.name.length > 64) return res.status(400).json(new Reply(400, false, {message: "Name must be less than 64 characters"}));
            quark.name = req.body.name.trim();
        }
        // Update owner list
        if (req.body.owners) {
            if (!Array.isArray(req.body.owners)) return res.status(400).json(new Reply(400, false, {message: "Owners must be an array"}));
            if (req.body.owners.length < 1) return res.status(400).json(new Reply(400, false, {message: "Quark must have at least one owner"}));
            let stop = false;
            let erMsg = "";
            req.body.owners.forEach((owner) => {
                if (!stop) {
                    if (!mongoose.isValidObjectId(owner)) {
                        stop = true
                        return erMsg = `${owner} is not a valid user id`;
                    }
                    if (!quark.members.includes(owner)) {
                        stop = true;
                        return erMsg = `${owner} is not a member of this quark`;
                    }
                }
            })
            if (stop) return res.status(400).json(new InvalidReplyMessage(erMsg));
            quark.owners = req.body.owners;
        }
        const finishUpdate = async () => {
            // Save the quark
            await quark.save()
            res.json(new Reply(200, true, {message: "Quark updated", quark}));

            // Send update event
            let data = {
                eventId: "quarkUpdate",
                quark: quark
            }
            subscriptionListener.emit("event", `quark_${quark._id}` , data);
        }
        // Update invite
        if (req.body.invite && typeof req.body.invite === "string") {
            req.body.invite = req.body.invite.replace(/[^A-Za-z0-9-_.]/g, "-").toLowerCase();
            if (req.body.invite.trim().length > 16) return res.status(400).json(new Reply(400, false, {message: "Invite must be less than 16 characters"}));
            quark.invite = req.body.invite;
            let inviteQuark = await Quarks.findOne({invite: req.body.invite});
            if (inviteQuark) return res.status(400).json(new InvalidReplyMessage("Invite already in use"));
            finishUpdate();
        } else {
            finishUpdate();
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json(new ServerErrorReply());
    }
})

// Get emotes endpoint GET
router.get("/:id/emotes", Auth, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    let Emotes = db.getEmotes();
    try {
        let emotes = await Emotes.find({quark: req.params.id});
        res.json(new Reply(200, true, {emotes}));
    } catch (e) {
        console.error(e);
        res.status(500).json(new ServerErrorReply());
    }
})

// Create emote endpoint POST
// Expected fields: name, image in base64
// Optional fields: description, alt text
router.post("/:id/emotes", Auth, RequiredProperties([
    {property: "name", type: "string", minLength: 1, maxLength: 64, regex: /^[^:\s]+$/},
    {property: "image", type: "string"},
    {property: "description", type: "string", maxLength: 128, trim: true, optional: true},
    {property: "altText", type: "string", maxLength: 128, trim:true, optional: true}
]), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    // Check if user is an owner of the quark
    // TODO: role system
    let Quarks = db.getQuarks();
    try {
        let quark = await Quarks.findOne({_id: req.params.id});
        if (!quark) return res.status(404).json(new NotFoundReply("Quark not found"));
        if (!quark.owners.includes(res.locals.user._id)) return res.status(403).json(new Reply(403, false, {message: "You are not an owner of this quark"}));
        let Emote = db.getEmotes();
        let emote = new Emote({
            name: req.body.name.trim(),
            quark: req.params.id,
            createdBy: res.locals.user._id
        })

        if (req.body.description) emote.description = req.body.description.trim();
        if (req.body.altText) emote.altText = req.body.altText.trim();

        // Turn base64 string into buffer
        let fileBuffer = Buffer.from(req.body.image, "base64");
        if (fileBuffer.length > 1048576) return new InvalidReplyMessage("Emote must be less than 1MiB");

        // Ensure image is image/* :D no executable emotes please
        let imageType = await fileTypeFromBuffer(fileBuffer)
        if (!imageType || !imageType.mime.startsWith("image/")) return res.status(400).json(new InvalidReplyMessage("Invalid image type"));

        // Upload image to WC
        let formData = new FormData();

        // Perform sharp magic
        let image = sharp(fileBuffer);
        let metadata = await image.metadata();
        if (!metadata || !metadata.width || !metadata.height) return res.status(400).json(new InvalidReplyMessage("This image is broken"));
        if (metadata.width > 128 || metadata.height > 128) {
            // Scale down so largest side is 128
            let newWidth = metadata.width;
            let newHeight = metadata.height;
            if (metadata.width > metadata.height) {
                newWidth = 128;
                newHeight = Math.round((metadata.height / metadata.width) * 128);
            } else {
                newHeight = 128;
                newWidth = Math.round((metadata.width / metadata.height) * 128);
            }
            image.resize(newWidth, newHeight);
        }
        image.toFormat("webp", { nearLossless: true, quality: 50 });
        fileBuffer = await image.toBuffer();

        fs.writeFileSync(`/share/wcloud/${emote._id}.webp`, fileBuffer);
        formData.append(`${emote._id}.webp`, fs.createReadStream(`/share/wcloud/${emote._id}.webp`), { filename: `${emote._id}.webp` });

        formData.submit({host: "upload.wanderers.cloud", headers: {authentication: process.env.WC_TOKEN}}, (err, response) => {
            if (err) return res.json(new ServerErrorReply());
            response.resume()
            response.once("data", async (data) => {
                try {
                    emote.imageUri = data.toString().trim();
                    await emote.save();
                    res.json(new Reply(201, true, {message: "Emote created", emote}));
                } catch (e) {
                    console.error(e);
                    return res.json(new ServerErrorReply());
                }
            })
            response.once("end", () => {
                fs.unlinkSync(`/share/wcloud/${emote._id}.webp`);
            })
        })

    } catch (e) {
        console.error(e);
        res.status(500).json(new ServerErrorReply());
    }

})

// Modify emote endpoint PATCH
// Modifiable fields: name, description, alt text
router.patch("/:id/emotes/:emoteId", Auth, RequiredProperties([
    {property: "name", type: "string", minLength: 1, maxLength: 64, regex: /^[^:\s]+$/, optional: true},
    {property: "description", type: "string", maxLength: 128, trim: true, optional: true},
    {property: "altText", type: "string", maxLength: 128, trim:true, optional: true}
]), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    if (!mongoose.isValidObjectId(req.params.emoteId)) return res.status(400).json(new InvalidReplyMessage("Invalid emote id"));
    // Check if user is an owner of the quark
    try {
        let Quarks = db.getQuarks();
        let quark = await Quarks.findOne({_id: req.params.id});
        if (!quark) return res.status(404).json(new NotFoundReply("Quark not found"));
        // TODO: role system
        if (!quark.owners.includes(res.locals.user._id)) return res.status(403).json(new Reply(403, false, {message: "You are not an owner of this quark"}));
        let Emotes = db.getEmotes();
        let emote = await Emotes.findOne({_id: req.params.emoteId});
        if (!emote) return res.status(404).json(new NotFoundReply("Emote not found"));
        if (req.body.name) emote.name = req.body.name.trim();
        if (req.body.description) emote.description = req.body.description.trim();
        if (req.body.altText) emote.altText = req.body.altText.trim();
        await emote.save();
        res.json(new Reply(200, true, {message: "Emote updated", emote}));
    } catch (e) {
        console.error(e);
        res.status(500).json(new ServerErrorReply());
    }
})

// Delete emote endpoint DELETE
// Expected fields: _id
router.delete("/:id/emotes/:emoteId", Auth, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    if (!mongoose.isValidObjectId(req.params.emoteId)) return res.status(400).json(new InvalidReplyMessage("Invalid emote id"));
    // Check if user is an owner of the quark
    try {
        let Quarks = db.getQuarks();
        let quark = await Quarks.findOne({_id: req.params.id});
        if (!quark) return res.status(404).json(new NotFoundReply("Quark not found"));
        if (!quark.owners.includes(res.locals.user._id)) return res.status(403).json(new Reply(403, false, {message: "You are not an owner of this quark"}));
        let Emotes = db.getEmotes();
        let emote = await Emotes.findOne({_id: req.params.emoteId, quark: req.params.id});
        if (!emote) return res.status(404).json(new NotFoundReply("Emote not found"));
        await emote.deleteOne();
        res.json(new Reply(200, true, {message: "Emote deleted"}));
    } catch (e) {
        console.error(e);
        res.status(500).json(new ServerErrorReply());
    }
})

router.get("/emotes/:emoteId", async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.emoteId)) return res.status(400).json(new InvalidReplyMessage("Invalid emote id"));
    let Emotes = db.getEmotes();
    let emote = await Emotes.findOne({_id: req.params.emoteId});
    if (!emote) return res.status(404).json(new NotFoundReply("Emote not found"));
    res.reply(new Reply(200, true, {message: "Emote found", emote}));
});

router.get("/emotes/:emoteId/image", async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.emoteId)) return res.status(400).json(new InvalidReplyMessage("Invalid emote id"));
    let Emotes = db.getEmotes();
    let emote = await Emotes.findOne({_id: req.params.emoteId});
    if (!emote) return res.status(404).json(new NotFoundReply("Emote not found"));
    res.redirect(emote.imageUri);
});

export default router;