import * as Mongoose from "mongoose";
export default new Mongoose.Schema({
    sender: {type: Mongoose.Types.ObjectId, required: true}, // Who sent it
    receiver: {type: Mongoose.Types.ObjectId, required: true}, // Who is it for
    reason: {type: String, required: false}, // Free form text field for users to explain why they requested to be friends
});