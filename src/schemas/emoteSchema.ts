import * as Mongoose from "mongoose";

export default new Mongoose.Schema({
    name: String,
    imageUri: String,
    altText: String,
    quark: { type: Mongoose.Types.ObjectId, index: true },
    description: String,
    createdBy: { type: Mongoose.Types.ObjectId, index: true }
});
