import {Types} from "mongoose";

// Users
export const ConstantID_SystemUser = new Types.ObjectId("000000000000000000000001")

// vQuarks
export const ConstantID_DMvQuark = new Types.ObjectId("000000000000000000000000")

// Roles
export const ConstantID_OwnerRole = new Types.ObjectId("000000000000000000000002")
export const ConstantID_DenyRole = new Types.ObjectId("000000000000000000000004")

// Permission assignments
export const ConstantID_DenyAssignment = new Types.ObjectId("000000000000000000000005")
export const ConstantID_OwnerAssignment = new Types.ObjectId("000000000000000000000003")