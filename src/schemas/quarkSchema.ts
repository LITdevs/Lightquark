import * as Mongoose from "mongoose";

const QuarkSchema = new Mongoose.Schema({
    _id: Mongoose.Types.ObjectId,
    members: Array, // <--- also dumb, replace eventually
    name: String,
    iconUri: String,
    //emotes: Array, lol no this is dumb
    //roles: Array,
    //bans: Array,
    channels: Array, // <---- STUPID >:( #LIGHTQUARK-45
    invite: { type: String, unique: true },
    owners: Array
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

QuarkSchema.virtual("roles", {
    ref: "roles",
    localField: "_id",
    foreignField: "quark"
})

export default QuarkSchema;