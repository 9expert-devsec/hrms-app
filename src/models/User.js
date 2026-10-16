import mongoose, { Schema, models } from "mongoose";
import "server-only";

const UserSchema = new Schema(
  {
    name: String,
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Role key (see src/lib/rbac). No enum: roles are data now; the round-8
    // editor validates keys against the roles collection.
    role: { type: String, default: "employee", trim: true, lowercase: true },
    // Linked Employee. Already written by POST /api/employees; it was being
    // stripped because the schema lacked it.
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
    status: { type: String, enum: ["active","suspended"], default: "active" },
    // Temporary-password flow (src/lib/accounts.js): the user must set a new
    // password at next sign-in while mustChangePassword is true.
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: Date,
    passwordResetAt: Date,
    passwordResetBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastLoginAt: Date,
    // Sign-in lockout (src/lib/loginLockout.js): consecutive wrong passwords,
    // and the time a lock ends (null / past = not locked).
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

export default models.User || mongoose.model("User", UserSchema);
