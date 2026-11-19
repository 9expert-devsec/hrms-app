import { Schema, model, models } from "mongoose";

/**
 * Leave settings — one document (`key: "default"`), edited on
 * ตั้งค่าการลา › ทั่วไป. Times are "HH:mm"; ranges are "HH:mm–HH:mm".
 *
 * `hrSigners`: ordered Employee ids; any ONE of them signs the HR step. A
 * signer never signs their own leave: another signer must; if the requester
 * is the only signer, the step is recorded as self-approval (round 40).
 */
const LeaveSettingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    fiscalYearStartMonth: { type: Number, min: 1, max: 12, default: 1 },
    hoursPerDay: { type: Number, min: 1, max: 24, default: 8 },
    workdayStart: { type: String, default: "09:00" },
    workdayEnd: { type: String, default: "18:00" },
    halfDayMorning: { type: String, default: "09:00–12:00" },
    halfDayAfternoon: { type: String, default: "13:00–18:00" },
    hrSigners: { type: [{ type: Schema.Types.ObjectId, ref: "Employee" }], default: [] },
  },
  { timestamps: true }
);

export default models.LeaveSettings || model("LeaveSettings", LeaveSettingsSchema);
