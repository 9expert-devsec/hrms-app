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
    empAutoId: { type: String, index: true }, // เช่น IT-0001
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
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
    empAutoId: { type: Number, unique: true }, // อย่าให้เป็น null
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    signatureDataUrl: { type: String, default: "" }, // PNG data URL
    signatureUpdatedAt: { type: Date },

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
  },
  { timestamps: true }
);

export default models.Employee || model("Employee", EmployeeSchema);
