/**
 * Leave request flow (QF-HRD-001): statuses, history actions and the labels
 * the pages show. Pure — browser-safe.
 *
 *   submit ─► pending_approval ─(step 1: approver 1 or 2)─► pending_hr ─(HR)─► approved
 *                 │  ▲                                          │                │
 *                 ▼  │ resubmit (revision + 1, approvals cleared)│                ▼
 *               returned ◄──────────── returned by a step ───────┘        cancel_requested
 *                 │                                                      (HR approves → cancelled,
 *   withdraw (owner, before final approval) ─► cancelled                  days come back; round 42)
 *
 * An auto-approve employee (no approvers) goes straight to pending_hr; step 1
 * is recorded as auto-completed.
 */

export const LEAVE_STATUSES = ["pending_approval", "returned", "pending_hr", "approved", "cancel_requested", "cancelled"];
/** Values of the first leave flow, still readable on old records. */
export const LEGACY_LEAVE_STATUSES = ["pending", "hod_approved", "rejected"];

export const HISTORY_ACTIONS = [
  "submitted",
  "resubmitted",
  "withdrawn",
  "returned",
  "approved_step1",
  "acknowledged",
  "approved_hr",
  "cancel_requested",
  "cancel_approved",
  "cancel_rejected",
];

/** The owner may withdraw (→ cancelled, no approval) while not finally approved. */
export const WITHDRAWABLE_STATUSES = ["pending_approval", "returned", "pending_hr"];

/** A3: hours that count against the quota. */
export const QUOTA_USED_STATUSES = ["approved", "cancel_requested"];
export const QUOTA_PENDING_STATUSES = ["pending_approval", "pending_hr"];

/** Status chips (Figma "สถานะใบลา"); legacy values keep their old wording. */
export const STATUS_CHIPS = {
  pending_approval: { label: "รอผู้อนุมัติ", bg: "#FEF3C7", color: "#92400E" },
  returned: { label: "ส่งกลับแก้ไข", bg: "#FEE2E2", color: "#B91C1C" },
  pending_hr: { label: "รอ HR", bg: "#FEF3C7", color: "#92400E" },
  approved: { label: "อนุมัติแล้ว", bg: "#DCFCE7", color: "#166534" },
  cancel_requested: { label: "ขอยกเลิก", bg: "#FEE2E2", color: "#B91C1C" },
  cancelled: { label: "ยกเลิกแล้ว", bg: "#EEF2F7", color: "#475569" },
  pending: { label: "รอ HOD อนุมัติ", bg: "#FEF3C7", color: "#92400E" },
  hod_approved: { label: "รอ HR อนุมัติ", bg: "#DBEAFE", color: "#1E40AF" },
  rejected: { label: "ไม่อนุมัติ", bg: "#FEE2E2", color: "#991B1B" },
};

export const HISTORY_ACTION_LABELS = {
  submitted: "ส่งใบลา",
  resubmitted: "ส่งใหม่",
  withdrawn: "ยกเลิกใบลา",
  returned: "ส่งกลับแก้ไข",
  approved_step1: "ผู้อนุมัติอนุมัติ",
  acknowledged: "รับทราบ",
  approved_hr: "ฝ่ายบุคคลอนุมัติ",
  cancel_requested: "ขอยกเลิก",
  cancel_approved: "อนุมัติการยกเลิก",
  cancel_rejected: "ปฏิเสธการยกเลิก",
};

/** Which approval step returned a leave (returnInfo.step). */
export const STEP_LABELS = { 1: "ผู้อนุมัติ", 2: "ฝ่ายบุคคล" };

/** "ขอ" + type name: เรื่อง on the form. */
export const leaveSubject = (typeName) => `ขอ${String(typeName || "").trim()}`;
