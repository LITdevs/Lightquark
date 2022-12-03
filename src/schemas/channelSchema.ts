import * as Mongoose from "mongoose";

export default new Mongoose.Schema({
    _id: Mongoose.Types.ObjectId,
    name: String,
    description: String,
    quark: Mongoose.Types.ObjectId
});