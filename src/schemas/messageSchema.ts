import * as Mongoose from "mongoose";
import {safeUser} from "../util/safeUser.js";
import {plainStatus} from "../routes/v3/user/status.js";

const schema = new Mongoose.Schema({
    _id: Mongoose.Types.ObjectId,
    authorId: Mongoose.Types.ObjectId,
    content: String,
    channelId: Mongoose.Types.ObjectId,
    ua: { type: String, default: "Unknown" },
    timestamp: Number,
    edited: { type: Boolean, default: false },
    attachments: [String],
    specialAttributes: [Object]
}, {
    toObject: {
        virtuals: true
    },
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.__v;
            return ret;
        }
    },
});
schema.virtual("author", {
    ref: "user",
    localField: "authorId",
    foreignField: "_id",
    justOne: true
})
const findHook = function (this: any, next: () => void) {
    if (this.options._recursed) {
        return next();
    }
    this.populate({
        path: "author",
        options: {
            _recursed: true
        },
        populate: {path: "avatarDoc"},
        transform: doc => {
            // If the document has a "passwordHash" property it is probably a user document
            if (doc?.passwordHash) {
                // Clean up the status object in the user if present
                // (will never be present unless added to populate path)
                if (doc?.status) doc.status = plainStatus(doc.status, doc._id) 
                return safeUser(doc)
            }
            return doc
        }
    });
    next()
}
schema.pre('findOne', findHook);
schema.pre('find', findHook);

export default schema;