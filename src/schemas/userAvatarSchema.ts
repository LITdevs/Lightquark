import * as Mongoose from "mongoose";

export default new Mongoose.Schema({
    _id: Mongoose.Types.ObjectId,
    userId: { type: Mongoose.Types.ObjectId, ref: 'users' },
    avatarUri: String
});