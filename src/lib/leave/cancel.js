import "server-only";
import mongoose from "mongoose";
import Leave from "@/models/Leave";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";
import { employeeDisplayName, employeeFullNameTh } from "@/lib/employeeName";
import { LeaveError } from "@/lib/leave/requests";
import { ALREADY_ACTED, NO_HR_SIGNER, hrSelfApproval, viewerOf } from "@/lib/leave/approval";
import { notifyLeave } from "@/lib/leave/notify";

/**
 * Cancelling a leave after final approval (QF-HRD-001), round 42.
 * Callers must have called dbConnect().
 *
 *   approved ─ owner asks (reason) ─► cancel_requested ─ HR signer ─┬─ approve → cancelled (days come back)
 *                                                                    └─ reject  → approved
 *
 * The quota is derived from the status (lib/leave/flow.js): while
 * cancel_requested the hours still count as used; once cancelled they do
 * not, so nothing else is written. Self-approval: the round-41 rule
 * (hrSelfApproval). Decisions are one conditional update (409 when lost).
 */

const REASON_MAX = 1000;
const oid = (v) => (v && mongoose.isValidObjectId(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null);
const str = (v) => (v == null ? "" : String(v));
const nameOf = (emp) => (emp ? employeeFullNameTh(emp) || employeeDisplayName(emp) || "-" : "");

/**
 * A6 — may the owner ask to cancel this leave now? Any time after final
 * approval, also after the leave dates; HR decides.
 */
export function cancelRequestAllowed(leave) {
  return leave?.status === "approved";
}

/**
 * A7 — what a cancel gives back: the whole leave (no partial cancel), in
 * hours. The one place to change if partial cancels are ever allowed.
 */
export function cancelReturnHours(leave) {
  return Number(leave?.totalHours) || 0;
}

const revisionOf = (body) => (body?.revision != null && body.revision !== "" && Number.isInteger(Number(body.revision)) ? Number(body.revision) : undefined);

/** Owner: approved → cancel_requested, with a reason. */
export async function requestCancel(session, id, body = {}) {
  const lid = oid(id);
  const emp = await getOwnEmployee(session, "_id");
  const leave = lid ? await Leave.findById(lid).lean() : null;
  if (!leave || !emp || str(leave.employeeId) !== str(emp._id)) throw new LeaveError("ไม่พบใบลา", 404);
  if (!cancelRequestAllowed(leave)) throw new LeaveError("ขอยกเลิกได้เฉพาะใบลาที่อนุมัติแล้ว", 409);
  const reason = String(body.reason || "").trim();
  if (!reason) throw new LeaveError("กรุณาระบุเหตุผลที่ขอยกเลิก", 400, "reason");
  if (reason.length > REASON_MAX) throw new LeaveError(`เหตุผลยาวเกิน ${REASON_MAX} ตัวอักษร`, 400, "reason");

  const at = new Date();
  const userId = oid(session.user.id);
  const doc = await Leave.findOneAndUpdate(
    { _id: leave._id, status: "approved" },
    {
      $set: { status: "cancel_requested", cancelRequest: { requestedBy: userId, requestedAt: at, reason, selfApproved: false } },
      $push: { history: { action: "cancel_requested", byUserId: userId, at, note: reason, revision: leave.revision || 1 } },
    },
    { new: true }
  );
  if (!doc) throw new LeaveError(ALREADY_ACTED, 409);
  await notifyLeave(doc, "cancel_requested", session);
  return doc.toObject();
}

/** HR signer: cancel_requested → cancelled (approved) or back to approved (rejected). */
export async function decideCancel(session, id, body = {}) {
  const lid = oid(id);
  const leave = lid ? await Leave.findById(lid).lean() : null;
  if (!leave) throw new LeaveError("ไม่พบใบลา", 404);
  const v = await viewerOf(session);
  if (!v.signerIds.length) throw new LeaveError(NO_HR_SIGNER, 403);
  if (!v.isSigner) throw new LeaveError("เฉพาะผู้ลงนามฝ่ายบุคคลที่กำหนดใน ตั้งค่าการลา ดำเนินการขั้นนี้ได้", 403);
  const self = hrSelfApproval({ actorEmpId: v.empId, ownerEmpId: leave.employeeId, signerIds: v.signerIds });
  if (!self.allowed) throw new LeaveError("ใบลาของคุณเองต้องให้ผู้ลงนามฝ่ายบุคคลคนอื่นดำเนินการ", 403);
  const decision = body.decision === "approved" ? "approved" : body.decision === "rejected" ? "rejected" : null;
  if (!decision) throw new LeaveError("คำสั่งไม่ถูกต้อง", 400);
  if (leave.status !== "cancel_requested") throw new LeaveError(ALREADY_ACTED, 409);
  const note = String(body.note || "").trim();
  if (note.length > REASON_MAX) throw new LeaveError(`หมายเหตุยาวเกิน ${REASON_MAX} ตัวอักษร`, 400, "note");

  const at = new Date();
  const userId = oid(session.user.id);
  const selfApproved = self.self && decision === "approved";
  const q = { _id: leave._id, status: "cancel_requested" };
  const rev = revisionOf(body);
  if (rev !== undefined) q.revision = rev;
  const doc = await Leave.findOneAndUpdate(
    q,
    {
      $set: {
        status: decision === "approved" ? "cancelled" : "approved",
        "cancelRequest.decision": decision,
        "cancelRequest.decidedAt": at,
        "cancelRequest.decidedBy": userId,
        "cancelRequest.decidedByEmployeeId": oid(v.empId),
        "cancelRequest.decidedByName": nameOf(v.emp),
        "cancelRequest.note": note,
        "cancelRequest.selfApproved": selfApproved,
      },
      $push: {
        history: { action: decision === "approved" ? "cancel_approved" : "cancel_rejected", byUserId: userId, at, note, revision: leave.revision || 1, step: 2, selfApproved },
      },
    },
    { new: true }
  );
  if (!doc) throw new LeaveError(ALREADY_ACTED, 409);
  await notifyLeave(doc, decision === "approved" ? "cancel_approved" : "cancel_rejected", session);
  return doc.toObject();
}
