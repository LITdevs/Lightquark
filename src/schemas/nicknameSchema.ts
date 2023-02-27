import * as Mongoose from "mongoose";

export default new Mongoose.Schema({
    userId: Mongoose.Types.ObjectId,
    scope: String,
    nickname: String
});