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
            })
        })
    })
})

export default router;