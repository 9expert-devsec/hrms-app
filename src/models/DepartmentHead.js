import mongoose, { Schema } from "mongoose";

const DepartmentHeadSchema = new Schema(
  {
    departmentCode: { type: String, required: true },
    userId:         { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy:     { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// One HOD per department
DepartmentHeadSchema.index({ departmentCode: 1 }, { unique: true });

export default mongoose.models.DepartmentHead ||
  mongoose.model("DepartmentHead", DepartmentHeadSchema);
