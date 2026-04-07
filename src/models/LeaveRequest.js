import mongoose, { Schema } from "mongoose";

const FileSchema = new Schema(
  {
    name: String,
    url: String,
    size: Number,
    mime: String,
  },
  { _id: false }
);

const SignSchema = new Schema(
  {
    who: { type: String, enum: ["employee", "hod", "hr"], required: true },
    name: String,    // ชื่อผู้ลงนาม
    title: String,   // ตำแหน่ง
    at: Date,        // เวลา
    dataUrl: String, // base64 ลายเซ็น
  },
  { _id: false }
);

const LeaveRequestSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    typeCode: { type: String, required: true }, // เช่น AL/SL/PL/...
    reason: { type: String, default: "" },
    notes:  { type: String, default: "" },      // ✅ เพิ่มฟิลด์นี้

    startDate: { type: Date, required: true },
    endDate:   { type: Date, required: true },
    durationDays: Number,

    attachments: [FileSchema],

    // สถานะการไหล
    status: { type: String, enum: ["pending_hod","pending_hr","approved","rejected"], default: "pending_hod" },

    // โซ่อานุมัติ
    flow: {
      hodEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
      hrEmployeeId:  { type: Schema.Types.ObjectId, ref: "Employee" },
    },

    // เอกสาร/ลายเซ็น
    docHtml: String,
    signatures: [SignSchema],

    approverRemark: String,
    approvedAt: Date,
  },
  { timestamps: true }
);

// ให้แน่ใจว่าเวลาปรับสคีมาใน dev จะไม่ติดแคชของ Mongoose
// (ช่วยให้แก้ไข schema ได้โดยไม่ต้องรีสตาร์ทบ่อย)
export default (() => {
  const name = "LeaveRequest";
  if (mongoose.models[name]) {
    // ลบโมเดลเก่าออกก่อนเพื่อให้สคีมาใหม่ถูกใช้ (เฉพาะ dev)
    delete mongoose.models[name];
  }
  return mongoose.model(name, LeaveRequestSchema);
})();
