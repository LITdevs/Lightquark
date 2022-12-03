import express, {Request, Response, Router} from 'express';
import Reply from "../classes/reply/Reply.js";
import { Auth } from './auth.js';
import db from "../db.js";
import * as mongoose from "mongoose";
import ServerErrorReply from "../classes/reply/ServerErrorReply.js";
import InvalidReplyMessage from "../classes/reply/InvalidReplyMessage.js";
import NotFoundReply from "../classes/reply/NotFoundReply.js";

const router: Router = express.Router();

/**
 * Get servers that the user is a member of.
 * Servers are called Quarks.
 */
router.get("/me", Auth, (req, res) => {
    let Quarks = db.getQuarks();
    Quarks.find({ members: res.locals.user._id}, (err, quarks) => {
        if (err) return res.status(500).json(new Reply(500, false, {message: "An error occurred while fetching quarks"}));
        res.json(new Reply(200, true, {message: "Here are the quarks you are a member of", quarks}));
    })
});

/**
 * Create a new quark
 * @param name The name of the quark
 */
router.post("/create", Auth, (req, res) => {
    if (!req.body.name || !req.body.name.trim()) return res.json(new Reply(400, false, {message: "Name is required"}));
    if (req.body.name.length > 64) return res.json(new Reply(400, false, {message: "Name must be less than 64 characters"}));
    let Quark = db.getQuarks();
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
    newQuark.save((err, quark) => {
        if (err) {
            console.error(err);
            return res.status(500).json(new ServerErrorReply());
        }
        let Channel = db.getChannels();
        let newChannel = new Channel({
            _id: defaultChannelId,
            name: "general",
            quark: quark._id,
            description: "The default channel"
        })
        newChannel.save((err) => {
            if (err) {
                console.error(err);
                return res.status(500).json(new ServerErrorReply());
            }
            res.json(new Reply(200, true, {message: "Quark created", quark}));
        })
    })
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
router.delete("/:id", Auth, (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a quark id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    let Quarks = db.getQuarks();
    Quarks.findOne({ _id: req.params.id, owners: res.locals.user._id }, (err, quark) => {
        if (err) {
            console.error(err);
            return res.status(500).json(new ServerErrorReply());
        }
        if (!quark) return res.status(404).json(new NotFoundReply("Quark not found, or you are not an owner"));
        Quarks.deleteOne({ _id: quark._id, owners: res.locals.user._id }, (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json(new ServerErrorReply());
            }
            res.json(new Reply(200, true, {message: "Quark deleted"}));
        })
    })
})

/**
 * Get a quark by id
 */
router.get("/:id", Auth, (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a quark id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    let Quarks = db.getQuarks();
    Quarks.findOne({ _id: req.params.id }, (err, quark) => {
        if (err) {
            console.error(err);
            return res.status(500).json(new ServerErrorReply());
        }
        if (!quark) return res.status(404).json(new NotFoundReply("Quark not found"));
        res.json(new Reply(200, true, {message: "Here is the quark", quark}));
    })
})

/**
 * Get a quark by invite
 */
router.get("/invite/:invite", (req, res) => {
    if (!req.params.invite) return res.status(400).json(new InvalidReplyMessage("Invalid invite"));
    let Quarks = db.getQuarks();
    Quarks.findOne({ invite: req.params.invite }, (err, inviteQuark) => {
        if (err) {
            console.error(err);
            return res.status(500).json(new ServerErrorReply());
        }
        if (!inviteQuark) return res.status(404).json(new NotFoundReply("Invalid invite"));
        res.json(new Reply(200, true, {message: "Invite valid!", quark: inviteQuark}));
    })
})

/**
 * Join a quark by invite
 */
router.post("/invite/:invite", Auth, (req, res) => {
    if (!req.params.invite) return res.status(400).json(new InvalidReplyMessage("Invalid invite"));
    let Quarks = db.getQuarks();
    Quarks.findOne({ invite: req.params.invite }, (err, inviteQuark) => {
        if (err) {
            console.error(err);
            return res.status(500).json(new ServerErrorReply());
        }
        if (!inviteQuark) return res.status(404).json(new NotFoundReply("Invalid invite"));
        if (inviteQuark.members.includes(res.locals.user._id)) return res.status(400).json(new InvalidReplyMessage("You are already a member of this quark"));
        inviteQuark.members.push(res.locals.user._id);
        inviteQuark.save((err) => {
            if (err) {
                console.error(err);
                return res.status(500).json(new ServerErrorReply());
            }
            res.json(new Reply(200, true, {message: "Joined quark", quark: inviteQuark}));
        });
    })
})

/**
 * Edit a quark by id
 */
// TODO: Allow roles to edit quarks
router.patch("/:id", Auth, (req, res) => {
    if (!req.params.id) return res.status(400).json(new InvalidReplyMessage("Provide a quark id"));
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json(new InvalidReplyMessage("Invalid quark id"));
    let Quarks = db.getQuarks();
    Quarks.findOne({ _id: req.params.id }, (err, quark) => {
        if (err) {
            console.error(err);
            return res.status(500).json(new ServerErrorReply());
        }
        if (!quark) return res.status(404).json(new NotFoundReply("Quark not found"));
        if (!quark.owners.includes(res.locals.user._id)) return res.status(403).json(new Reply(403, false, {message: "You are not an owner of this quark"}));
        // Update name
        if (req.body.name) {
            if (req.body.name.length > 64) return res.status(400).json(new Reply(400, false, {message: "Name must be less than 64 characters"}));
            quark.name = req.body.name.trim();
        }
        // Update invite
        if (req.body.invite) {
            req.body.invite = req.body.invite.replace(/[^A-Za-z0-9-_.]/g, "-").toLowerCase();
            if (req.body.invite.trim().length > 16) return res.status(400).json(new Reply(400, false, {message: "Invite must be less than 16 characters"}));
            quark.invite = req.body.invite.trim();
        }
        // Update owner list
        if (req.body.owners) {
            if (!Array.isArray(req.body.owners)) return res.status(400).json(new Reply(400, false, {message: "Owners must be an array"}));
            req.body.owners.forEach((owner) => {
                if (!mongoose.isValidObjectId(owner)) return res.status(400).json(new Reply(400, false, {message: `${owner} is not a valid user id`}));
                if (!quark.members.includes(owner)) return res.status(400).json(new Reply(400, false, {message: `${owner} is not a member of this quark`}));
            })
            quark.owners = req.body.owners;
        }
        // Save the quark
        quark.save((err) => {
            if (err) {
                console.error(err);
                return res.status(500).json(new ServerErrorReply());
            }
            res.json(new Reply(200, true, {message: "Quark updated", quark}));
        });
    })
})

export default router;