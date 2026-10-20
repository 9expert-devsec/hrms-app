import mongoose, { Schema, models } from "mongoose";
import "server-only";
import {
  OFFSITE_STATUSES,
  MEMBER_STATUSES,
  APPROVAL_STATUSES,
  APPROVAL_ROLES,
  TRAVEL_MODES,
  ALLOWANCE_OPTIONS,
} from "@/lib/offsiteRules";

/**
 * Off-site work request (ทำงานนอกสถานที่), one day per request. Every write
 * goes through lib/offsite.js, which owns the status machine and appends to
 * `events`. Signatures are PNG data-URL COPIES taken at signing time.
 */

const MemberSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    nameSnapshot: { type: String, default: "" },
    duty: { type: String, default: "" },
    status: { type: String, enum: MEMBER_STATUSES, default: "invited" },
    signature: { type: String, default: "" },
    respondedAt: { type: Date, default: null },
    declineReason: { type: String, default: "" },
    // Revision whose invitation this member answers; null = not sent yet.
    invitedInRevision: { type: Number, default: null },
  },
  { _id: false }
);

const ApprovalSchema = new Schema(
  {
    step: { type: Number, enum: [1, 2, 3], required: true },
    role: { type: String, enum: APPROVAL_ROLES, required: true },
    // Resolved when the step becomes active (step 1: the team leader, kept in
    // step with `leader`; legacy role "creator" = signed by the creator).
    approver: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    approverName: { type: String, default: "" },
    status: { type: String, enum: APPROVAL_STATUSES, default: "waiting" },
    signature: { type: String, default: "" },
    signedAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    reason: { type: String, default: "" },
    // Steps 2–3: the approver is the creator or a member of this request
    // (allowed, but tagged). Never set on step 1.
    selfApproval: { type: Boolean, default: false },
  },
  { _id: false }
);

/** Why the request was last returned (rejection at step 2/3, or a member decline = step 0). */
const ReturnInfoSchema = new Schema(
  {
    at: Date,
    step: Number,
    byName: String,
    reason: String,
    revision: Number,
  },
  { _id: false }
);

/** What changed between the returned revision and the resent one. */
const ChangeSummarySchema = new Schema(
  {
    fromRevision: Number,
    toRevision: Number,
    fields: { type: [String], default: [] }, // offsiteRules.CHANGE_FIELD_LABELS keys
    membersAdded: { type: [String], default: [] }, // names
    membersRemoved: { type: [String], default: [] },
    memberSetChanged: { type: Boolean, default: false },
    // Names; set only when the team leader changed.
    leaderChange: { type: new Schema({ from: String, to: String }, { _id: false }), default: undefined },
  },
  { _id: false }
);

const EventSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, required: true },
    detail: { type: String, default: "" },
  },
  { _id: false }
);

const OffsiteRequestSchema = new Schema(
  {
    // OS-2569-0001, assigned at the FIRST send of invitations (drafts have none).
    docNo: { type: String, default: undefined },
    createdBy: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    createdByUser: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Creator snapshot ("ข้าพเจ้า … ตำแหน่ง … แผนก"), refreshed at step-1 submit.
    creatorNameTh: { type: String, default: "" },
    creatorPosition: { type: String, default: "" },
    creatorDepartment: { type: String, default: "" },

    jobName: { type: String, required: true, trim: true },
    workDate: { type: Date, required: true }, // UTC midnight of the work day
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true }, // HH:mm
    description: { type: String, default: "" },
    placeName: { type: String, default: "" },
    address: { type: String, default: "" },
    travelMode: { type: String, enum: TRAVEL_MODES, required: true },
    note: { type: String, default: "" },

    leader: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    members: { type: [MemberSchema], default: [] },
    approvals: { type: [ApprovalSchema], default: [] },

    hrSummary: {
      allowanceOption: { type: String, enum: [...ALLOWANCE_OPTIONS, null], default: null },
      amountPerPerson: { type: Number, default: null },
      note: { type: String, default: "" },
    },

    status: { type: String, enum: OFFSITE_STATUSES, default: "draft" },
    revision: { type: Number, default: 0 }, // bumped on every send of invitations
    // Job details (lib/offsiteRules.detailsKey) as last sent to members: a
    // resend with different details re-invites everyone.
    sentDetailsKey: { type: String, default: "" },
    // Everyone who ever approved or rejected a step (read access + "ที่ฉันเคยอนุมัติ").
    pastApprovers: { type: [{ type: Schema.Types.ObjectId, ref: "Employee" }], default: [] },
    returnInfo: { type: ReturnInfoSchema, default: null },
    // Internal: details + members as they were when returned; compared on resend.
    returnSnapshot: { type: Schema.Types.Mixed, default: null },
    changeSummary: { type: ChangeSummarySchema, default: null },
    events: { type: [EventSchema], default: [] },
  },
  { timestamps: true, optimisticConcurrency: true }
);

// Unique only once assigned. Replaces OS-1's plain unique `docNo_1`, which
// must be dropped where it exists (it would treat every draft's missing
// docNo as a duplicate null).
OffsiteRequestSchema.index(
  { docNo: 1 },
  { unique: true, name: "docNo_unique_when_set", partialFilterExpression: { docNo: { $type: "string" } } }
);
OffsiteRequestSchema.index({ pastApprovers: 1 });

OffsiteRequestSchema.index({ createdBy: 1, createdAt: -1 });
OffsiteRequestSchema.index({ "members.employee": 1, status: 1 });
OffsiteRequestSchema.index({ status: 1 });
OffsiteRequestSchema.index({ "approvals.approver": 1, "approvals.status": 1 });

export default models.OffsiteRequest || mongoose.model("OffsiteRequest", OffsiteRequestSchema);
