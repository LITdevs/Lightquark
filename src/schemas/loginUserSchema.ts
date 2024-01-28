import * as Mongoose from "mongoose";
import networkInformation from "../networkInformation.js";
import {plainStatus} from "../routes/v3/user/status.js";

const schema = new Mongoose.Schema({
    _id: Mongoose.Types.ObjectId,
    passwordHash: Buffer,
    email: {type: String, unique : true},
    salt: Buffer,
    username: String,
    admin: Boolean,
    isBot: {type: Boolean, default: false}
}, {
    toObject: {
        virtuals: true
    },
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.avatarDoc;
            delete ret.avatar; // This is a leftover field from LITauth, avatarUri contains the real one
            delete ret.passwordHash;
            delete ret.salt;
            delete ret.__v;
            return ret;
        }
    },
});
schema.virtual("avatarDoc", {
    ref: "avatar",
    localField: "_id",
    foreignField: "userId",
    justOne: true
})
schema.virtual("status", {
    ref: "statuses",
    localField: "_id",
    foreignField: "userId",
    justOne: true
})
schema.virtual("avatarUri").get(function () {
    // @ts-ignore I don't know how to tell it avatarDoc exists
    return this.avatarDoc?.avatarUri || `${networkInformation.baseUrl}/defaultUser.webp`;
})

// Add hook to find and findOne to populate virtuals
const findHook = function (this: any, next: () => void) {
    if (this.options._recursed) {
        return next();
    }
    this.populate({
        path: "avatarDoc status",
        options: {
            _recursed: true
        },
        transform: doc => {
            if (doc?.type) return plainStatus(doc) // If the document has a "type" property it is probably a status document
            return doc
        }
    });
    next()
}
schema.pre('findOne', findHook);
schema.pre('find', findHook);

export default schema;