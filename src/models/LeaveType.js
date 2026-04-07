// src/models/LeaveType.js
import mongoose, { Schema } from "mongoose";

const LeaveTypeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true }, // AL, SL, PL ...
    name: { type: String, required: true },               // ลาพักร้อน, ลาป่วย, ลากิจ
    color: { type: String, default: "#64748b" },
    countable: { type: Boolean, default: true },          // false = เคสพิเศษ นับครั้งแต่ไม่หักโควตา
  },
  { timestamps: true }
);

export default mongoose.models.LeaveType ||
  mongoose.model("LeaveType", LeaveTypeSchema);
