import mongoose, { Schema } from "mongoose";

const LeaveBalanceSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    year:       { type: Number, required: true },

    sick:     { total: { type: Number, default: 30 }, used: { type: Number, default: 0 } },
    annual:   { total: { type: Number, default: 10 }, used: { type: Number, default: 0 } },
    personal: { total: { type: Number, default: 3 },  used: { type: Number, default: 0 } },
  },
  { timestamps: true }
);

LeaveBalanceSchema.index({ employeeId: 1, year: 1 }, { unique: true });

export default mongoose.models.LeaveBalance || mongoose.model("LeaveBalance", LeaveBalanceSchema);
