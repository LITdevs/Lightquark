import * as Mongoose from "mongoose";

export default new Mongoose.Schema({
    _id: Mongoose.Types.ObjectId,
    authorId: Mongoose.Types.ObjectId,
    content: String,
    channelId: Mongoose.Types.ObjectId,
    ua: { type: String, default: "Unknown" },
    timestamp: Number,
    edited: { type: Boolean, default: false },
    attachments: [String]
});
