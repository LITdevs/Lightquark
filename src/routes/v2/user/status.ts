import express from "express";
import Auth from "../../../util/Auth.js";
import FeatureFlag from "../../../util/FeatureFlagMiddleware.js";
import db from "../../../db.js";
import Reply from "../../../classes/reply/Reply.js";
import {networkInformation} from "../../../index.js";
import NotFoundReply from "../../../classes/reply/NotFoundReply.js";
import {isValidObjectId, Types} from "mongoose";
import InvalidReplyMessage from "../../../classes/reply/InvalidReplyMessage.js";
import ForbiddenReply from "../../../classes/reply/ForbiddenReply.js";
import RequiredProperties from "../../../util/RequiredProperties.js";
import {STATUS_TYPES} from "../../../schemas/userStatusSchema.js";
import validDataUrl, {isValidImageDataUrl} from "../../../util/validDataUrl.js";

const router = express.Router({
    mergeParams: true
});

// Kill switch
router.use(FeatureFlag("LQ_Status"));

/**
 * Cursed image endpoint
 * type is either primary or secondary
 * get the relevant image from the user status
 * parse the data uri
 * set content-type to the mime type
 * create buffer from base64 part of data uri and send that as response
 */
router.get("/(:type)Image", async (req, res) => {
    if (!["primary", "secondary"].includes(req.params.type)) return res.reply(new NotFoundReply())
    let Statuses = db.getStatuses();
    let status = await Statuses.findOne({userId: req.params.id})
    if (!status) return res.reply(new NotFoundReply("This user has no status"))
    if (!status[`${req.params.type}Image`]) return res.reply(new NotFoundReply(`This user status has no ${req.params.type} image`))
    let regExMatches = status[`${req.params.type}Image`].match('data:(image/.*);base64,(.*)');
    res.header("Content-Type", regExMatches[1])
    res.send(Buffer.from(regExMatches[2], "base64"))
})

router.use(Auth);
router.use((req, res, next) => {
    if (req.params.id === "me") {
        req.userId = res.locals.user._id
    } else {
        req.userId = req.params.id
    }
    next()
})

router.get("/", async (req, res) => {
    if (!isValidObjectId(req.userId)) return res.reply(new InvalidReplyMessage("Invalid user"))
    let Statuses = db.getStatuses();
    let status = await Statuses.findOne({userId: req.userId})
    if (!status) return res.reply(new NotFoundReply("Status not found", true))
    res.reply(new Reply(200, true, {
        message: "Status found",
        status: plainStatus(status)
    }))
})

router.delete("/", async (req, res) => {
    if (!isValidObjectId(req.userId)) return res.reply(new InvalidReplyMessage("Invalid user"))
    if (req.userId !== res.locals.user._id.toString()) return res.reply(new ForbiddenReply("You can only clear your own status"))
    let Statuses = db.getStatuses();
    let deletionResult = await Statuses.deleteOne({userId: req.userId});
    if (deletionResult.deletedCount === 0) return res.reply(new NotFoundReply("No status to clear"))
    return res.reply(new Reply(200, true, {
        message: "Status cleared"
    }))
})

router.post("/", RequiredProperties([
    {
        property: "type",
        type: "string",
        enum: STATUS_TYPES
    },
    {
        property: "content",
        type: "string",
        minLength: 1,
        maxLength: 131 // lol
    },
    {
        property: "primaryImage",
        type: "string",
        optional: true,
        custom: (value) => {
            return {pass: isValidImageDataUrl(value), reason: "primaryImage should be base64 image data url"}
        }
    },
    {
        property: "secondaryImage",
        type: "string",
        optional: true,
        custom: (value) => {
            return {pass: isValidImageDataUrl(value), reason: "secondaryImage should be base64 image data url"}
        }
    },
    {
        property: "primaryLink",
        type: "string",
        optional: true,
        custom: (value) => {
            return {pass: value.startsWith("http"), reason: "primaryLink should be a link"}
        }
    },
    {
        property: "secondaryLink",
        type: "string",
        optional: true,
        custom: (value) => {
            return {pass: value.startsWith("http"), reason: "secondaryLink should be a link"}
        }
    },
    {
        property: "startTime",
        type: "number",
        optional: true
    },
    {
        property: "endTime",
        type: "number",
        optional: true
    },
    {
        property: "paused",
        type: "boolean",
        optional: true
    }
]), async (req, res, next) => {
    try {
        if (!isValidObjectId(req.userId)) return res.reply(new InvalidReplyMessage("Invalid user"))
        if (req.userId !== res.locals.user._id.toString()) return res.reply(new ForbiddenReply("You can only set your own status"))
        let Statuses = db.getStatuses();
        await Statuses.deleteOne({userId: req.userId});
        let status = new Statuses({
            _id: new Types.ObjectId(),
            userId: res.locals.user._id,
            type: req.body.type,
            content: req.body.content,
            primaryImage: req.body.primaryImage,
            primaryLink: req.body.primaryLink,
            secondaryImage: req.body.secondaryImage,
            secondaryLink: req.body.secondaryLink,
            startTime: new Date(req.body.startTime),
            endTime: new Date(req.body.endTime),
            paused: req.body.paused
        })
        await status.save();
        res.reply(new Reply(200, true, {
            message: "Status set",
            status: plainStatus(status)
        }))
    } catch (e) {
        next(e)
    }
})

/**
 * Turn status into a status without _id and userId, replace images with links to real images :tm:
 * @param status
 */
export function plainStatus(status) {
    if (!status) return undefined;
    status = status.toJSON();
    status.primaryImage = `${networkInformation.baseUrl}/v2/user/${status.userId}/status/primaryImage`
    status.secondaryImage = `${networkInformation.baseUrl}/v2/user/${status.userId}/status/secondaryImage`
    status._id = undefined;
    status.userId = undefined;
    status.__v = undefined;
    return status
}

export default router;