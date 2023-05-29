import * as Mongoose from "mongoose";

let RoleSchema = new Mongoose.Schema({
    name: String,
    color: String,
    quark: { type: Mongoose.Types.ObjectId, index: true },
    description: String,
    createdBy: { type: Mongoose.Types.ObjectId, index: true },
    priority: Number,
    isDefault: { type: Boolean, default: false }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

RoleSchema.virtual("permissionAssignments", {
    ref: "permissionAssignments",
    localField: "_id",
    foreignField: "role"
})

RoleSchema.virtual("roleAssignments", {
    ref: "roleAssignments",
    localField: "_id",
    foreignField: "role"
})

export default RoleSchema;