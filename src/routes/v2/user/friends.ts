import express from "express";
import Auth from "../../../util/Auth.js";
import FeatureFlag from "../../../util/FeatureFlagMiddleware.js";
import db from "../../../db.js";
import Reply from "../../../classes/reply/Reply.js";
import {getUserBulk} from "../channel.js";
import {isValidObjectId} from "mongoose";
import InvalidReplyMessage from "../../../classes/reply/InvalidReplyMessage.js";
import {getNick} from "../../../util/getNickname.js";
import {Scope} from "@sentry/node";

const router = express.Router({
    mergeParams: true
});

// Kill switch
router.use(FeatureFlag("LQ_Friends"));

router.use(Auth);

/**
 * List friend requests (incoming & outgoing)
 */
router.get("/requests", async (req, res) => {
    let FriendRequests = db.getFriendRequests();
    let requests = await FriendRequests.find({$or: [{sender: res.locals.user._id}, {receiver: res.locals.user._id}]})
    res.reply(new Reply(200, true, {
        message: "Here are your friend requests (incoming & outgoing)",
        requests
    }))
})

/**
 * Send or accept friend requests
 */
router.post("/requests/:username", async (req, res) => {
    let otherParty = await getUserByName(req.params.username)
    if (!otherParty) return res.reply(new InvalidReplyMessage("Invalid user"))
    if (otherParty._id.equals(res.locals.user._id)) {
        let reply = new Reply(999, false, {
            message: "baka"
        })
        reply.request.cat = "this request is so stupid there isnt a cat to describe it"
        res.status(999).json(reply)
    }
    let Friend = db.getFriends()
    let existingFriend = await Friend.findOne({parties: [res.locals.user._id, otherParty._id]});
    if (existingFriend) return res.reply(new InvalidReplyMessage("You are already friends with this user"))
    let FriendRequest = db.getFriendRequests()
    let existingRequest = await FriendRequest.findOne({$or: [{sender: res.locals.user._id, receiver: otherParty._id}, {receiver: res.locals.user._id, sender: otherParty._id}]})
    if (existingRequest) {
        if (existingRequest.sender.equals(res.locals.user._id)) return res.reply(new InvalidReplyMessage("You have already sent a friend request to this user"));
        // ACCEPT FRIEND REQUEST
        await FriendRequest.deleteOne({_id: existingRequest._id});
        let friend = new Friend({
            startedAt: new Date(),
            parties: [res.locals.user._id,  otherParty._id]
        })
        await friend.save();
        return res.reply(new Reply(200, true, {
            message: "Friend request accepted"
        }))
    } else {
        // SEND FRIEND REQUEST
        let friendRequest = new FriendRequest({
            sender: res.locals.user._id,
            receiver: otherParty._id,
            reason: req.body.reason && typeof req.body.reason === "string" ? req.body.reason : null
        })
        await friendRequest.save();
        return res.reply(new Reply(201, true, {
            message: "Request sent!"
        }));
    }
})

async function getUserByName(username : string) {
    let LoginUser = db.getLoginUsers()
    let loginUser = await LoginUser.findOne({username: username})
    if (loginUser) return (await getUserBulk([loginUser._id], null))[0]
    return null
    // This is actually terrible because LITauth usernames arent supposed to be exposed
    // FIXME
}

export default router;