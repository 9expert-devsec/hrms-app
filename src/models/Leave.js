import mongoose, { Schema } from "mongoose";

const LeaveSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    userId:     { type: Schema.Types.ObjectId, ref: "User",     required: true },

    leaveType: {
      type: String,
      enum: ["sick", "annual", "personal", "maternity", "paternity", "other"],
      required: true,
    },

    startDate: { type: Date,   required: true },
    endDate:   { type: Date,   required: true },
    totalDays: { type: Number, required: true },
    reason:    { type: String, required: true },

    status: {
      type: String,
      enum: ["pending", "hod_approved", "approved", "rejected", "cancelled"],
      default: "pending",
    },

    attachmentUrl: { type: String }, // backward compat with old records

    attachments: [{
      url:      { type: String },
      publicId: { type: String },
      name:     { type: String },
      type:     { type: String, enum: ["image", "document"] },
      size:     { type: Number },
    }],

    // Employee signature (collected when submitting)
    employeeSignature: { type: String },

    // HOD approval (Step 1)
    hodApproverId:   { type: Schema.Types.ObjectId, ref: "User" },
    hodApproverNote: { type: String },
    hodApprovedAt:   { type: Date },
    hodSignature:    { type: String },

    // HR final approval (Step 2)
    hrApproverId:   { type: Schema.Types.ObjectId, ref: "User" },
    hrApproverNote: { type: String },
    hrApprovedAt:   { type: Date },
    hrSignature:    { type: String },

    // Rejection tracking
    rejectedBy: { type: String, enum: ["hod", "hr"] },
    rejectedAt: { type: Date },
  },
  { timestamps: true }
);

// Force schema refresh in dev to pick up enum changes
export default (() => {
  if (mongoose.models.Leave) {
    delete mongoose.models.Leave;
  }
  return mongoose.model("Leave", LeaveSchema);
})();
