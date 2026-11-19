import "server-only";
import mongoose from "mongoose";
import Leave from "@/models/Leave";
import LeaveType from "@/models/LeaveType";
import LeaveSettings from "@/models/LeaveSettings";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import { canSeeLeaveDocument } from "@/lib/rbac/leaveScope";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";
import { FORM_CATEGORIES } from "@/lib/leaveRules";
import { EMPLOYEE_NAME_FIELDS, employeeDisplayName, employeeFullNameTh } from "@/lib/employeeName";
import { HOURS_PER_DAY, dateKeyOf } from "@/lib/leave/countLeave";
import { LeaveError } from "@/lib/leave/requests";
import { fiscalYearStats } from "@/lib/leave/approval";
import { cancelRequestAllowed, cancelReturnHours } from "@/lib/leave/cancel";

/**
 * The leave document (QF-HRD-001 REV.03): everything the form and the
 * document page need, for one round-40+ leave. Callers must have called
 * dbConnect(). Who may read it: lib/rbac/leaveScope.js canSeeLeaveDocument
 * (owner, approver (1)/(2) on this leave, HR signers, the HR leave scopes,
 * department heads, superadmin); anyone else gets the same 404 as a missing id.
 *
 * HR stats: frozen on the leave when HR approves (Leave.hrStats); a leave
 * that has not reached that point shows them computed now.
 */

const oid = (v) => (v && mongoose.isValidObjectId(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null);
const str = (v) => (v == null ? "" : String(v));
const iso = (d) => (d ? new Date(d).toISOString() : null);
const nameOf = (emp) => (emp ? employeeFullNameTh(emp) || employeeDisplayName(emp) || "-" : "");

/** Is this a round-40+ leave (the new form)? Old-flow records have no leaveTypeId. */
export const isNewFlowLeave = (leave) => !!leave?.leaveTypeId;

/** "LV-2569-1A2B": fiscal year (พ.ศ.) + the id's last 4 characters. */
export function leaveCode(leave) {
  const y = leave.fiscalYear ?? new Date(leave.startDate).getUTCFullYear();
  return `LV-${y + 543}-${str(leave._id).slice(-4).toUpperCase()}`;
}

/**
 * The form row a leave type ticks ("ขอ ☐ลาป่วย ☐ลากิจ ☐ลาพักร้อน ☐อื่นๆ"):
 * by the type's round-39 form category, never by its Thai name.
 */
export const formRowOf = (category) => (FORM_CATEGORIES.includes(category) && category !== "other" ? category : "other");

const step = (s) => (s ? { name: s.name || "", at: iso(s.at), signature: s.signature || "", note: s.note || "", decision: s.decision || null, role: s.role || null, auto: !!s.auto, selfApproved: !!s.selfApproved } : null);

/** Timeline items from the history: completed events, newest last. */
function timeline(leave, namesByUser, empIdByUser) {
  const roleNo = (uid) => (str(empIdByUser.get(str(uid))) === str(leave.approver1Id) ? 1 : 2);
  const out = [];
  for (const h of leave.history || []) {
    const who = namesByUser.get(str(h.byUserId)) || "";
    let label = null;
    let tone = "done";
    if (h.action === "submitted") label = "ส่งใบลา";
    else if (h.action === "resubmitted") label = `ส่งใหม่ (ครั้งที่ ${h.revision || 2})`;
    else if (h.action === "approved_step1") label = h.note === "auto" ? "อนุมัติอัตโนมัติ" : `อนุมัติ (${roleNo(h.byUserId)})`;
    else if (h.action === "acknowledged") label = `รับทราบ (${roleNo(h.byUserId)})`;
    else if (h.action === "approved_hr") label = h.selfApproved ? "ฝ่ายบุคคลอนุมัติ (อนุมัติตนเอง)" : "ฝ่ายบุคคลอนุมัติ";
    else if (h.action === "returned") {
      label = h.step === 2 ? "ฝ่ายบุคคลส่งกลับแก้ไข" : "ส่งกลับแก้ไข";
      tone = "returned";
    } else if (h.action === "withdrawn") {
      label = "ผู้ขอยกเลิกใบลา";
      tone = "returned";
    } else if (h.action === "cancel_requested") label = "ขอยกเลิก";
    else if (h.action === "cancel_approved") label = h.selfApproved ? "อนุมัติการยกเลิก (อนุมัติตนเอง)" : "อนุมัติการยกเลิก";
    else if (h.action === "cancel_rejected") {
      label = "ปฏิเสธคำขอยกเลิก";
      tone = "returned";
    }
    if (label) out.push({ label, name: h.note === "auto" ? "" : who, at: iso(h.at), tone, note: h.action === "returned" || h.action === "cancel_requested" || h.action === "cancel_rejected" ? h.note || "" : "" });
  }
  return out;
}

/** The document for one leave id, or LeaveError 404. */
export async function leaveDocument(session, id) {
  const lid = oid(id);
  const leave = lid ? await Leave.findById(lid).lean() : null;
  if (!leave || !isNewFlowLeave(leave)) throw new LeaveError("ไม่พบรายการลา", 404);
  const owner = await Employee.findById(leave.employeeId).select(`_id ${EMPLOYEE_NAME_FIELDS} position department departmentId userId`).lean();
  if (!(await canSeeLeaveDocument(session, { ownerUserId: leave.userId, employee: owner, leave }))) throw new LeaveError("ไม่พบรายการลา", 404);

  const [settings, dept, type, ownEmp] = await Promise.all([
    LeaveSettings.findOne({ key: "default" }).select("hoursPerDay").lean(),
    owner?.departmentId ? Department.findById(owner.departmentId).select("name").lean() : null,
    LeaveType.findById(leave.leaveTypeId).select("formCategory nameTh").lean(),
    getOwnEmployee(session, "_id"),
  ]);
  const hoursPerDay = Number(settings?.hoursPerDay) > 0 ? Number(settings.hoursPerDay) : HOURS_PER_DAY;

  // Last leave's category: stored since round 42; older snapshots by the type's name.
  let lastCategory = leave.lastLeaveSnapshot?.formCategory || null;
  if (leave.lastLeaveSnapshot && !lastCategory) {
    const t = await LeaveType.findOne({ nameTh: leave.lastLeaveSnapshot.leaveTypeName }).select("formCategory").lean();
    lastCategory = t?.formCategory || "other";
  }

  // Names for the timeline (history stores User ids).
  const userIds = [...new Set((leave.history || []).map((h) => str(h.byUserId)).filter(Boolean))];
  const emps = userIds.length ? await Employee.find({ userId: { $in: userIds.map(oid) } }).select(`_id userId ${EMPLOYEE_NAME_FIELDS}`).lean() : [];
  const namesByUser = new Map(emps.map((e) => [str(e.userId), nameOf(e)]));
  const empIdByUser = new Map(emps.map((e) => [str(e.userId), str(e._id)]));

  const category = formRowOf(type?.formCategory || leave.leaveType);
  const submits = (leave.history || []).filter((h) => h.action === "submitted" || h.action === "resubmitted");
  const isOwner = !!ownEmp && str(ownEmp._id) === str(leave.employeeId);
  const stats = leave.hrStats?.length ? leave.hrStats : await fiscalYearStats(leave);

  return {
    _id: str(leave._id),
    code: leaveCode(leave),
    status: leave.status,
    revision: leave.revision || 1,
    hoursPerDay,
    isOwner,
    canRequestCancel: isOwner && cancelRequestAllowed(leave),
    cancelReturnHours: cancelReturnHours(leave),
    statsFrozen: !!leave.hrStats?.length,
    timeline: timeline(leave, namesByUser, empIdByUser),
    cancelRequest: leave.cancelRequest
      ? {
          requestedAt: iso(leave.cancelRequest.requestedAt),
          reason: leave.cancelRequest.reason || "",
          decision: leave.cancelRequest.decision || null,
          decidedAt: iso(leave.cancelRequest.decidedAt),
          decidedByName: leave.cancelRequest.decidedByName || "",
          note: leave.cancelRequest.note || "",
        }
      : null,
    form: {
      submittedAt: iso(submits.length ? submits[submits.length - 1].at : leave.createdAt),
      subject: leave.subject || "",
      addressedTo: leave.addressedTo || "",
      employeeName: nameOf(owner),
      position: (owner?.position || "").trim(),
      department: dept?.name || owner?.department || "",
      category,
      typeName: leave.leaveTypeName || type?.nameTh || "",
      reason: leave.reason || "",
      unit: leave.unit || "full_day",
      halfDayPeriod: leave.halfDayPeriod || null,
      startTime: leave.startTime || null,
      endTime: leave.endTime || null,
      startDate: dateKeyOf(leave.startDate),
      endDate: dateKeyOf(leave.endDate),
      totalHours: leave.totalHours || 0,
      lastLeave: leave.lastLeaveSnapshot
        ? {
            category: formRowOf(lastCategory),
            startDate: dateKeyOf(leave.lastLeaveSnapshot.startDate),
            endDate: dateKeyOf(leave.lastLeaveSnapshot.endDate),
            totalHours: leave.lastLeaveSnapshot.totalHours || 0,
            unit: leave.lastLeaveSnapshot.unit || null,
          }
        : null,
      contact: leave.contactDuringLeave || "",
      employeeSignature: leave.employeeSignature || "",
      autoApproved: !!leave.autoApproved,
      step1: step(leave.step1),
      ack: leave.step1Ack?.at && leave.step1Ack?.employeeId ? step(leave.step1Ack) : null,
      hr: step(leave.hrStep),
      stats,
      watermark: leave.status === "cancelled" ? "ยกเลิกแล้ว" : leave.status === "cancel_requested" ? "ขอยกเลิก" : null,
    },
  };
}
