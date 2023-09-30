import * as Mongoose from "mongoose";
import {Schema} from "mongoose";

export default new Mongoose.Schema({
    userId: Mongoose.Types.ObjectId,
    key: {type: String, index: true},
    value: Schema.Types.Mixed
});