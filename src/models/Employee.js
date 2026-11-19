import { Schema, model, models } from "mongoose";
import "server-only";

const EmergencySchema = new Schema(
  {
    firstName: String,
    lastName: String,
    relationship: String,
    phone: String,
    email: String,
    address: String,
  },
  { _id: false }
);

const BookbankSchema = new Schema(
  {
    accountHolderName: String,
    accountNumber: String,
    bankName: String,
    branchName: String,
  },
  { _id: false }
);

const EmployeeSchema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    // Thai name (lib/employeeName.js). Optional here so existing records stay
    // valid; POST /api/employees requires all three, and an edit may not clear
    // a value once set.
    titleTh: { type: String, enum: ["นาย", "นาง", "นางสาว"] },
    firstNameTh: { type: String, trim: true },
    lastNameTh: { type: String, trim: true },
    nickName: { type: String },
    department: { type: String, required: true }, // เช่น "IT"
    position: { type: String, required: true }, // เช่น "Senior IT Support"
    level: { type: Number, min: 1, max: 6, required: true }, // 1..6
    dateOfJoin: { type: Date, required: true },
    birthday: { type: Date, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, index: true },
    address: { type: String },
    gender: { type: String, enum: ["male", "female", "other"] },
    photoUrl: { type: String },
    photoPublicId: { type: String, default: null },
    // The frame chosen for the photo: fractions (0–1) of the original image
    // (lib/photoCrop.js). Unset → avatars keep the automatic framing.
    photoCrop: {
      type: new Schema({ x: Number, y: Number, width: Number, height: Number }, { _id: false }),
      default: undefined,
    },
    empAutoId: { type: Number, unique: true }, // อย่าให้เป็น null
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },

    emergency: {
      firstName: String,
      lastName: String,
      relationship: String,
      phone: String,
      email: String,
      address: String,
    },

    privateInfo: {
      bankAccountName: String,
      bankAccountNo: String,
      bankName: String,
      bankBranch: String,
    },

    // ผูกกับ user id ถ้ามีการสร้างบัญชีล็อกอิน
    userId: { type: Schema.Types.ObjectId, ref: "User" },

    // Who approves this employee's leave (ตั้งค่าการลา › ผู้อนุมัติ;
    // lib/leaveRules.js). Both empty → approved automatically (HR still sees
    // it); one person → that person approves; two different people → either
    // approves, the other may acknowledge. Approver 2 is never set without 1.
    leaveApprover1Id: { type: Schema.Types.ObjectId, ref: "Employee", default: null, index: true },
    leaveApprover2Id: { type: Schema.Types.ObjectId, ref: "Employee", default: null, index: true },
  },
  { timestamps: true }
);

export default models.Employee || model("Employee", EmployeeSchema);
