// src/lib/models/LeaveQuota.js
import mongoose, { Schema } from "mongoose";

const LeaveQuotaSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", index: true, required: true },
    year: { type: Number, index: true, required: true },
    typeCode: { type: String, required: true }, // AL, SL, PL
    allocated: { type: Number, default: 0 },    // โควตาที่ให้ต่อปี
    carryForward: { type: Number, default: 0 }, // โอนไป/ยกมา
  },
  { timestamps: true }
);
LeaveQuotaSchema.index({ employeeId: 1, year: 1, typeCode: 1 }, { unique: true });

export default mongoose.models.LeaveQuota ||
  mongoose.model("LeaveQuota", LeaveQuotaSchema);
