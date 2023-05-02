import * as Mongoose from "mongoose";

export default new Mongoose.Schema({
    _id: Mongoose.Types.ObjectId,
    members: Array,
    name: String,
    iconUri: String,
    //emotes: Array, lol no this is dumb
    roles: Array,
    bans: Array,
    channels: Array,
    invite: { type: String, unique: true },
    owners: Array
});