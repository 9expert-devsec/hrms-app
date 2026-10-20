import mongoose, { Schema, models } from "mongoose";
import "server-only";

/**
 * Every "ลืมรหัสผ่าน" request and what came of it (lib/passwordReset.js) —
 * the rate-limit counter and the log of refused requests. No address is
 * stored, only its SHA-256 (so unknown addresses are not collected). Rows
 * expire after 24 hours (TTL on `at`).
 *
 * outcome: issued | unknown | not_company | suspended | rate_limited_account | rate_limited_ip
 */
const PasswordResetRequestSchema = new Schema({
  at: { type: Date, default: Date.now },
  ip: { type: String, default: "" },
  user: { type: Schema.Types.ObjectId, ref: "User", default: null },
  emailHash: { type: String, default: "" },
  outcome: { type: String, required: true },
});

PasswordResetRequestSchema.index({ at: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
PasswordResetRequestSchema.index({ ip: 1, at: -1 });
PasswordResetRequestSchema.index({ user: 1, outcome: 1, at: -1 });

export default models.PasswordResetRequest || mongoose.model("PasswordResetRequest", PasswordResetRequestSchema);
