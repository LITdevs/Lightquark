import * as Mongoose from "mongoose";

export default new Mongoose.Schema({
    _id: Mongoose.Types.ObjectId,
    authorId: Mongoose.Types.ObjectId,
    content: String,
    channelId: Mongoose.Types.ObjectId,
    timestamp: Number
});