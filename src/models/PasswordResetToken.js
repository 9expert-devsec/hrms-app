import mongoose, { Schema, models } from "mongoose";
import "server-only";

/**
 * One "ลืมรหัสผ่าน" link (lib/passwordReset.js). Only the SHA-256 hash of the
 * token is stored; the token itself exists only in the email. Single use
 * (usedAt); a new request deletes the user's older unused tokens. MongoDB
 * removes a row once expiresAt passes (TTL).
 */
const PasswordResetTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    requestedIp: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PasswordResetTokenSchema.index({ tokenHash: 1 }, { unique: true });
PasswordResetTokenSchema.index({ user: 1, usedAt: 1 });
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default models.PasswordResetToken || mongoose.model("PasswordResetToken", PasswordResetTokenSchema);
