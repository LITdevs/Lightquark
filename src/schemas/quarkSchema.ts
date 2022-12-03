import * as Mongoose from "mongoose";

export default new Mongoose.Schema({
    _id: Mongoose.Types.ObjectId,
    members: Array,
    name: String,
    iconUri: String

});