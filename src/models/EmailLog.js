import mongoose, { Schema, models } from "mongoose";
import "server-only";

/**
 * One row per email attempt (lib/mail/postmark.js). No body is stored.
 * Rows expire after 180 days (TTL on `at`).
 */
const EmailLogSchema = new Schema({
  at: { type: Date, default: Date.now },
  to: { type: String, default: "" },
  type: { type: String, default: "" }, // e.g. offsite_invite (the Postmark tag)
  requestId: { type: Schema.Types.ObjectId, default: null },
  docNo: { type: String, default: "" },
  status: { type: String, enum: ["sent", "failed", "skipped"], required: true },
  reason: { type: String, default: "" }, // skipped: disabled | no-address; failed: the error
  postmarkMessageId: { type: String, default: "" },
});

EmailLogSchema.index({ at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
EmailLogSchema.index({ status: 1, at: -1 });
EmailLogSchema.index({ type: 1, at: -1 });

export default models.EmailLog || mongoose.model("EmailLog", EmailLogSchema);
