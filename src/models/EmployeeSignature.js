import mongoose, { Schema, models } from "mongoose";
import "server-only";

/**
 * An employee's saved signature (one per employee) — the ONE signature store,
 * used when they sign an off-site request (lib/offsite.js) or a leave request
 * / leave approval (the leave screens). Kept out of the Employee document so no
 * employee query or populate can carry it along, and never stored on a
 * public URL: it is read only through GET /api/signature (own signature).
 * Every signing copies `png` into the request, so changing it later never
 * alters a signed document.
 */
const EmployeeSignatureSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true, unique: true },
    png: { type: String, required: true }, // data:image/png;base64,… (≤ 60 KB decoded)
  },
  { timestamps: true }
);

export default models.EmployeeSignature || mongoose.model("EmployeeSignature", EmployeeSignatureSchema);
