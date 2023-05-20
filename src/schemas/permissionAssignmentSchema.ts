import * as Mongoose from "mongoose";

export default new Mongoose.Schema({
    role: { type: Mongoose.Types.ObjectId, index: true, ref: "roles" },
    permission: String,
    type: { type: String, enum: ["allow", "ignore", "deny"] },
    scopeType: { type: String, enum: ["quark", "channel"] },
    scopeId: Mongoose.Types.ObjectId
});
