import * as Mongoose from "mongoose";

const RoleAssignmentSchema = new Mongoose.Schema({
    role: { type: Mongoose.Types.ObjectId, index: true, ref: "roles" },
    quark: Mongoose.Types.ObjectId,
    user: Mongoose.Types.ObjectId
});

export default RoleAssignmentSchema;