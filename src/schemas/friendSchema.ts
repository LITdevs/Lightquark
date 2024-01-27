import * as Mongoose from "mongoose";
export default new Mongoose.Schema({
    parties: [{type: Object, required: true}], // Who is friends
    startedAt: Date, // When did the request get accepted
});