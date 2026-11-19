import { Schema, model, models } from "mongoose";

/**
 * Leave quota for one employee × fiscal year × leave type, set by HR on
 * ตั้งค่าการลา › โควตาวันลา. `fiscalYear` is the Gregorian year in which the
 * fiscal year starts (lib/leaveFiscal.js). `quotaDays` null = no limit.
 * No record ⇒ the type's defaultQuotaDays. Used days are not stored here —
 * they are computed from approved leaves.
 */
const LeaveEntitlementSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    fiscalYear: { type: Number, required: true },
    leaveTypeId: { type: Schema.Types.ObjectId, ref: "LeaveType", required: true },
    quotaDays: {
      type: Number,
      min: 0,
      default: null,
      validate: { validator: (v) => v === null || Number.isInteger(v * 2), message: "quotaDays must be in half-day steps" },
    },
  },
  { timestamps: true }
);

LeaveEntitlementSchema.index({ employeeId: 1, fiscalYear: 1, leaveTypeId: 1 }, { unique: true });
LeaveEntitlementSchema.index({ fiscalYear: 1, leaveTypeId: 1 });

export default models.LeaveEntitlement || model("LeaveEntitlement", LeaveEntitlementSchema);
