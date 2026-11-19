import mongoose, { Schema } from "mongoose";
import { LEAVE_STATUSES, LEGACY_LEAVE_STATUSES, HISTORY_ACTIONS } from "@/lib/leave/flow";
import { LEAVE_UNITS, HALF_DAY_PERIODS } from "@/lib/leave/countLeave";

/**
 * A leave request — paper form QF-HRD-001 REV.03 (round 40 onwards; flow and
 * statuses: lib/leave/flow.js, counting: lib/leave/countLeave.js, writes:
 * lib/leave/requests.js).
 *
 * LEGACY: records from the first leave flow use `leaveType` (enum) and the
 * statuses pending / hod_approved / rejected with the hod* / hr* fields
 * below. They stay readable so the old pages keep working; new requests also
 * set `leaveType` to the type's form category for those pages.
 */

/** One approval step (round 41/42 write them; resubmitting clears them). */
const StepSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, default: "" },
    signature: { type: String, default: "" },
    note: { type: String, default: "" },
    at: { type: Date, default: null },
    auto: { type: Boolean, default: false }, // step 1 of an auto-approve employee (A4)
  },
  { _id: false }
);

const HistorySchema = new Schema(
  {
    action: { type: String, enum: HISTORY_ACTIONS, required: true },
    byUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, default: Date.now },
    note: { type: String, default: "" },
    revision: { type: Number, default: null },
  },
  { _id: false }
);

const LeaveSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    userId:     { type: Schema.Types.ObjectId, ref: "User",     required: true },

    // Round-39 leave type + the name at submit time.
    leaveTypeId:   { type: Schema.Types.ObjectId, ref: "LeaveType", default: null },
    leaveTypeName: { type: String, default: "" },
    // LEGACY enum; no longer required (new requests store the form category).
    leaveType: {
      type: String,
      enum: ["sick", "annual", "personal", "maternity", "paternity", "other"],
    },

    unit:          { type: String, enum: LEAVE_UNITS },
    halfDayPeriod: { type: String, enum: HALF_DAY_PERIODS },
    startTime:     { type: String }, // "HH:mm", hourly only
    endTime:       { type: String },

    // Date-only values: UTC midnight of the Bangkok calendar date.
    startDate: { type: Date,   required: true },
    endDate:   { type: Date,   required: true },
    totalHours: { type: Number }, // the source of truth (server-computed)
    totalDays: { type: Number, required: true }, // = totalHours / hours per day, for legacy readers
    excludedDates: [{ _id: false, date: { type: Date }, reason: { type: String } }],
    fiscalYear: { type: Number }, // Gregorian start year (round-39 start-month setting)

    subject:            { type: String, default: "" }, // เรื่อง: "ขอ" + type name
    addressedTo:        { type: String, default: "" }, // เรียน: approver (1) at submit
    reason:             { type: String, required: true },
    contactDuringLeave: { type: String, default: "" },

    // Approver mapping at submit time (Employee ids; null = none).
    approver1Id: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    approver2Id: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    autoApproved: { type: Boolean, default: false },

    // "ข้าพเจ้าได้…ครั้งล่าสุด": the last approved leave before this one.
    lastLeaveSnapshot: {
      type: new Schema(
        { leaveTypeName: String, startDate: Date, endDate: Date, totalHours: Number, unit: String },
        { _id: false }
      ),
      default: null,
    },

    status: {
      type: String,
      enum: [...LEAVE_STATUSES, ...LEGACY_LEAVE_STATUSES],
      default: "pending_approval",
    },
    revision: { type: Number, default: 1 },
    history: { type: [HistorySchema], default: [] },

    // Steps (round 41–42). step1Ack = the other approver's "รับทราบ".
    step1:    { type: StepSchema, default: null },
    step1Ack: { type: StepSchema, default: null },
    hrStep:   { type: StepSchema, default: null },
    // Why the leave is `returned` (cleared on resubmit; the history keeps it).
    returnInfo: {
      type: new Schema(
        { step: Number, byUserId: { type: Schema.Types.ObjectId, ref: "User" }, byName: String, at: Date, reason: String },
        { _id: false }
      ),
      default: null,
    },
    // Cancelling after final approval (round 42): HR decides; approved → days come back.
    cancelRequest: {
      type: new Schema(
        {
          reason: String,
          requestedAt: Date,
          byUserId: { type: Schema.Types.ObjectId, ref: "User" },
          decision: { type: String, enum: ["approved", "rejected"] },
          decidedAt: Date,
          decidedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
          note: String,
        },
        { _id: false }
      ),
      default: null,
    },
    withdrawnAt: { type: Date, default: null },

    attachmentUrl: { type: String }, // backward compat with old records

    attachments: [{
      url:      { type: String },
      publicId: { type: String },
      name:     { type: String },
      type:     { type: String, enum: ["image", "document"] },
      size:     { type: Number },
    }],

    // Requester's signature: a PNG copy taken at submit (the profile signature).
    employeeSignature: { type: String },

    // LEGACY — HOD approval (Step 1 of the first flow)
    hodApproverId:   { type: Schema.Types.ObjectId, ref: "User" },
    hodApproverNote: { type: String },
    hodApprovedAt:   { type: Date },
    hodSignature:    { type: String },

    // LEGACY — HR final approval (Step 2 of the first flow)
    hrApproverId:   { type: Schema.Types.ObjectId, ref: "User" },
    hrApproverNote: { type: String },
    hrApprovedAt:   { type: Date },
    hrSignature:    { type: String },

    // LEGACY — rejection tracking (the new flow returns instead: returnInfo)
    rejectedBy: { type: String, enum: ["hod", "hr"] },
    rejectedAt: { type: Date },
  },
  { timestamps: true }
);

LeaveSchema.index({ employeeId: 1, leaveTypeId: 1, fiscalYear: 1, status: 1 });

// Force schema refresh in dev to pick up enum changes
export default (() => {
  if (mongoose.models.Leave) {
    delete mongoose.models.Leave;
  }
  return mongoose.model("Leave", LeaveSchema);
})();
