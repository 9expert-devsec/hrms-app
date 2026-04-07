import mongoose, { Schema, models } from "mongoose";
import "server-only";

const UserSchema = new Schema(
  {
    name: String,
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["superadmin","hr","it","payroll","manager","employee"],
      default: "employee",
    },
    status: { type: String, enum: ["active","suspended"], default: "active" },
    lastLoginAt: Date,
    failedLoginCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default models.User || mongoose.model("User", UserSchema);
