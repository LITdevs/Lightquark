import * as Mongoose from "mongoose";

export default new Mongoose.Schema({
    _id: Mongoose.Types.ObjectId,
    userId: Mongoose.Types.ObjectId,
    order: [String]
});