import "server-only";
import mongoose from "mongoose";
import Leave from "@/models/Leave";
import LeaveType from "@/models/LeaveType";
import LeaveEntitlement from "@/models/LeaveEntitlement";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import Holiday from "@/lib/models/Holiday";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";
import { getSignature } from "@/lib/offsite";
import { getLeaveSettings, weeklyDaysOffOf, currentFiscalYear } from "@/lib/leaveSettings";
import { fiscalYearOf, fiscalYearLabel, normalizeApprovers } from "@/lib/leaveRules";
import { EMPLOYEE_NAME_FIELDS, employeeDisplayName, employeeFullNameTh } from "@/lib/employeeName";
import { normalizePhotoCrop } from "@/lib/photoCrop";
import { signaturePngError } from "@/lib/signaturePng";
import {
  HOURS_PER_DAY,
  LEAVE_UNITS,
  TYPE_UNIT_OF_UNIT,
  countLeave,
  dateKeyOf,
  keyToDate,
  parseDateKey,
} from "@/lib/leave/countLeave";
import { formatLeaveAmount } from "@/lib/leave/format";
import { notifyLeave } from "@/lib/leave/notify";
import {
  QUOTA_PENDING_STATUSES,
  QUOTA_USED_STATUSES,
  WITHDRAWABLE_STATUSES,
  leaveSubject,
} from "@/lib/leave/flow";

/**
 * Leave requests (QF-HRD-001): submit, resubmit, withdraw, and the data the
 * ขอลา page needs. Callers must have called dbConnect() first. Every rule is
 * checked here, on the server; client totals are ignored.
 */

export class LeaveError extends Error {
  constructor(message, status = 400, field = undefined) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

const REASON_MAX = 1000;
const CONTACT_MAX = 200;
const MAX_ATTACHMENTS = 10;
/** Shown as เรียน when there is no approver (auto-approve, A4). */
const ADDRESSED_TO_HR = "ฝ่ายบุคคล";

const oid = (v) => (v && mongoose.isValidObjectId(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null);
const nameOf = (emp) => (emp ? employeeFullNameTh(emp) || employeeDisplayName(emp) || "-" : "");
const hoursPerDayOf = (settings) => Number(settings?.hoursPerDay) > 0 ? Number(settings.hoursPerDay) : HOURS_PER_DAY;

/* ── holidays ───────────────────────────────────────────────── */

/** Holidays from `fromKey` to `toKey` inclusive: [{ _id, date (key), name, kind }]. */
export async function listHolidaysBetween(fromKey, toKey) {
  const rows = await Holiday.find({ date: { $gte: keyToDate(fromKey), $lte: keyToDate(toKey) } })
    .sort({ date: 1 })
    .lean();
  return rows.map((h) => ({ _id: String(h._id), date: dateKeyOf(h.date), name: h.name, kind: h.type === "company" ? "company" : "public" }));
}

/* ── approvers ──────────────────────────────────────────────── */

const PERSON_FIELDS = `_id ${EMPLOYEE_NAME_FIELDS} position photoUrl photoCrop`;
const person = (e) => ({ _id: String(e._id), name: nameOf(e), position: (e.position || "").trim(), photoUrl: e.photoUrl || null, photoCrop: normalizePhotoCrop(e.photoCrop) });

/**
 * The employee's approval path, from the round-39 mapping:
 *   auto    — no approver set (MD/COO): step 1 is auto-completed (A4)
 *   single  — one approver; either — two, any one approves
 *   missing — approvers are set but none of them exists any more → blocked
 * approvers: [{ _id, name, ... }] (existing ones, approver 1 first).
 */
export async function approvalPathOf(emp) {
  const { approver1Id, approver2Id } = normalizeApprovers(emp.leaveApprover1Id, emp.leaveApprover2Id);
  const ids = [approver1Id, approver2Id].filter(Boolean);
  if (!ids.length) return { mode: "auto", approvers: [] };
  const found = await Employee.find({ _id: { $in: ids } }).select(PERSON_FIELDS).lean();
  const approvers = ids.map((id) => found.find((e) => String(e._id) === id)).filter(Boolean);
  if (!approvers.length) return { mode: "missing", approvers: [] };
  return { mode: approvers.length === 2 ? "either" : "single", approvers: approvers.map(person) };
}

/** HR signers from the settings, in order (names only). */
async function hrSignerNames(settings) {
  const ids = (settings.hrSigners || []).map(String);
  if (!ids.length) return [];
  const emps = await Employee.find({ _id: { $in: ids } }).select(EMPLOYEE_NAME_FIELDS).lean();
  return ids.map((id) => emps.find((e) => String(e._id) === id)).filter(Boolean).map(nameOf);
}

/* ── quota (A3) ─────────────────────────────────────────────── */

/**
 * Quota per fiscal year and type for one employee:
 *   { [fy]: { [typeId]: { quotaDays (null = no limit), usedHours, pendingHours } } }
 * quotaDays: the entitlement record when there is one, else the type default.
 * used = approved (+ cancel_requested); pending = pending_approval + pending_hr.
 */
export async function quotaSummary(employeeId, fiscalYears, types, { excludeLeaveId = null } = {}) {
  const empId = oid(employeeId);
  const [ents, sums] = await Promise.all([
    LeaveEntitlement.find({ employeeId: empId, fiscalYear: { $in: fiscalYears } }).lean(),
    Leave.aggregate([
      {
        $match: {
          employeeId: empId,
          fiscalYear: { $in: fiscalYears },
          leaveTypeId: { $ne: null },
          status: { $in: [...QUOTA_USED_STATUSES, ...QUOTA_PENDING_STATUSES] },
          ...(excludeLeaveId ? { _id: { $ne: oid(excludeLeaveId) } } : {}),
        },
      },
      { $group: { _id: { fy: "$fiscalYear", t: "$leaveTypeId", s: "$status" }, hours: { $sum: "$totalHours" } } },
    ]),
  ]);
  const out = {};
  for (const fy of fiscalYears) {
    out[fy] = {};
    for (const t of types) {
      const ent = ents.find((e) => e.fiscalYear === fy && String(e.leaveTypeId) === String(t._id));
      out[fy][String(t._id)] = { quotaDays: ent ? ent.quotaDays ?? null : t.defaultQuotaDays ?? null, usedHours: 0, pendingHours: 0 };
    }
  }
  for (const s of sums) {
    const cell = out[s._id.fy]?.[String(s._id.t)];
    if (!cell) continue;
    if (QUOTA_USED_STATUSES.includes(s._id.s)) cell.usedHours += s.hours || 0;
    else cell.pendingHours += s.hours || 0;
  }
  return out;
}

/* ── last approved leave ────────────────────────────────────── */

/** The employee's most recent approved leave starting before `beforeKey` (any, if null). */
async function lastApprovedLeave(employeeId, { beforeKey = null, excludeLeaveId = null } = {}) {
  const filter = { employeeId: oid(employeeId), status: "approved", leaveTypeId: { $ne: null } };
  if (beforeKey) filter.startDate = { $lt: keyToDate(beforeKey) };
  if (excludeLeaveId) filter._id = { $ne: oid(excludeLeaveId) };
  const l = await Leave.findOne(filter).sort({ startDate: -1, createdAt: -1 }).select("leaveTypeName startDate endDate totalHours unit").lean();
  return l ? { leaveTypeName: l.leaveTypeName, startDate: l.startDate, endDate: l.endDate, totalHours: l.totalHours, unit: l.unit } : null;
}

/* ── validation shared by submit and resubmit ───────────────── */

function cleanAttachments(list) {
  if (!Array.isArray(list)) return [];
  if (list.length > MAX_ATTACHMENTS) throw new LeaveError(`แนบไฟล์ได้ไม่เกิน ${MAX_ATTACHMENTS} ไฟล์`, 400, "attachments");
  return list.map((a) => {
    const url = String(a?.url || "");
    let ok = false;
    try {
      const u = new URL(url);
      ok = u.protocol === "https:" && u.hostname === "res.cloudinary.com";
    } catch {
      ok = false;
    }
    if (!ok) throw new LeaveError("ไฟล์แนบไม่ถูกต้อง", 400, "attachments");
    return {
      url,
      publicId: String(a.publicId || "").slice(0, 300),
      name: String(a.name || "ไฟล์แนบ").slice(0, 200),
      type: a.type === "image" ? "image" : "document",
      size: Number(a.size) > 0 ? Number(a.size) : 0,
    };
  });
}

/**
 * Checks a submitted form and returns the fields to store (§3 snapshots).
 * `existing`: the leave being resubmitted (excluded from its own quota).
 */
async function prepareLeave(session, body = {}, { existing = null } = {}) {
  const emp = await getOwnEmployee(session, null);
  if (!emp) throw new LeaveError("บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน", 403);

  const settings = await getLeaveSettings();
  const hoursPerDay = hoursPerDayOf(settings);

  // Type: active round-39 type, unit allowed by it.
  const typeId = oid(body.leaveTypeId);
  const type = typeId ? await LeaveType.findById(typeId).lean() : null;
  if (!type) throw new LeaveError("กรุณาเลือกประเภทการลา", 400, "leaveTypeId");
  if (type.isActive === false) throw new LeaveError(`ประเภท “${type.nameTh}” ปิดใช้งานแล้ว — เลือกประเภทอื่น`, 400, "leaveTypeId");
  const unit = body.unit;
  if (!LEAVE_UNITS.includes(unit)) throw new LeaveError("กรุณาเลือกรูปแบบการลา", 400, "unit");
  if (!(type.units || []).includes(TYPE_UNIT_OF_UNIT[unit])) throw new LeaveError(`${type.nameTh}ลาแบบนี้ไม่ได้`, 400, "unit");

  // Count (server-side; client totals ignored).
  const startKey = parseDateKey(body.startDate);
  const input = {
    unit,
    startDate: startKey,
    endDate: unit === "full_day" ? parseDateKey(body.endDate) : startKey,
    halfDayPeriod: unit === "half_day" ? body.halfDayPeriod : undefined,
    startTime: unit === "hourly" ? body.startTime : undefined,
    endTime: unit === "hourly" ? body.endTime : undefined,
  };
  const holidays = startKey && input.endDate && input.endDate >= startKey ? await listHolidaysBetween(startKey, input.endDate) : [];
  const count = countLeave(input, { weeklyDaysOff: weeklyDaysOffOf(settings), holidays, hoursPerDay });
  if (count.error) throw new LeaveError(count.error, 400, "dates");

  // Details.
  const reason = String(body.reason || "").trim();
  if (!reason) throw new LeaveError("กรุณาระบุเหตุผลการลา", 400, "reason");
  if (reason.length > REASON_MAX) throw new LeaveError(`เหตุผลการลายาวเกิน ${REASON_MAX} ตัวอักษร`, 400, "reason");
  const contact = String(body.contactDuringLeave || "").trim();
  if (!contact) throw new LeaveError("กรุณาระบุช่องทางติดต่อระหว่างลา", 400, "contactDuringLeave");
  if (contact.length > CONTACT_MAX) throw new LeaveError(`ช่องทางติดต่อยาวเกิน ${CONTACT_MAX} ตัวอักษร`, 400, "contactDuringLeave");
  const attachments = cleanAttachments(body.attachments);
  const attachFrom = type.requiresAttachmentFromDays;
  if (attachFrom !== null && attachFrom !== undefined && count.totalHours >= attachFrom * hoursPerDay && !attachments.length) {
    throw new LeaveError(`${type.nameTh}ตั้งแต่ ${attachFrom} วันขึ้นไปต้องแนบเอกสาร (เช่น ใบรับรองแพทย์)`, 400, "attachments");
  }

  // Quota (A3): fiscal year of the start date; approved + pending count.
  const fiscalYear = fiscalYearOf(keyToDate(startKey), settings.fiscalYearStartMonth || 1);
  const quota = (await quotaSummary(emp._id, [fiscalYear], [type], { excludeLeaveId: existing?._id }))[fiscalYear][String(type._id)];
  if (quota.quotaDays !== null) {
    const remaining = quota.quotaDays * hoursPerDay - quota.usedHours - quota.pendingHours;
    if (count.totalHours > remaining) {
      throw new LeaveError(
        `${type.nameTh}คงเหลือไม่พอ — ปีงบ ${fiscalYearLabel(fiscalYear)} เหลือ ${formatLeaveAmount(Math.max(remaining, 0), { hoursPerDay })} (รวมใบลาที่รออนุมัติ)`,
        400,
        "quota"
      );
    }
  }

  // Approvers (A4).
  const path = await approvalPathOf(emp);
  if (path.mode === "missing") throw new LeaveError("ยังไม่ได้กำหนดผู้อนุมัติ — ติดต่อฝ่ายบุคคล", 400, "approvers");

  // Signature: the profile signature; a drawn one only when none is saved.
  const saved = await getSignature(emp._id);
  let signature = saved?.png || null;
  if (!signature) {
    const drawn = body.employeeSignature || null;
    if (!drawn) throw new LeaveError("กรุณาลงลายเซ็นก่อนส่งใบลา", 400, "signature");
    const sigError = signaturePngError(drawn);
    if (sigError) throw new LeaveError(sigError, 400, "signature");
    signature = drawn;
  }

  const fields = {
    employeeId: emp._id,
    leaveTypeId: type._id,
    leaveTypeName: type.nameTh,
    leaveType: type.formCategory, // LEGACY readers (labels, calendar)
    unit,
    halfDayPeriod: input.halfDayPeriod,
    startTime: input.startTime,
    endTime: input.endTime,
    startDate: keyToDate(input.startDate),
    endDate: keyToDate(input.endDate),
    totalHours: count.totalHours,
    totalDays: count.totalHours / hoursPerDay,
    excludedDates: count.excluded.map((x) => ({ date: keyToDate(x.date), reason: x.reason })),
    fiscalYear,
    subject: leaveSubject(type.nameTh),
    addressedTo: path.mode === "auto" ? ADDRESSED_TO_HR : path.approvers[0].name,
    reason,
    contactDuringLeave: contact,
    attachments,
    employeeSignature: signature,
    approver1Id: path.approvers[0]?._id || null,
    approver2Id: path.approvers[1]?._id || null,
    autoApproved: path.mode === "auto",
    lastLeaveSnapshot: await lastApprovedLeave(emp._id, { beforeKey: input.startDate, excludeLeaveId: existing?._id }),
  };
  return { emp, fields, auto: path.mode === "auto" };
}

/** Status, step 1 and history entries for a (re)submission. */
function submissionState(action, userId, auto, revision) {
  const at = new Date();
  const history = [{ action, byUserId: userId, at, note: "", revision }];
  if (!auto) return { status: "pending_approval", step1: null, history };
  history.push({ action: "approved_step1", byUserId: null, at, note: "auto", revision });
  return { status: "pending_hr", step1: { auto: true, at, note: "auto", name: "อนุมัติอัตโนมัติ" }, history };
}

/* ── actions ────────────────────────────────────────────────── */

export async function submitLeave(session, body) {
  const userId = session.user.id;
  const { fields, auto } = await prepareLeave(session, body);
  const state = submissionState("submitted", userId, auto, 1);
  const leave = await Leave.create({ ...fields, userId, status: state.status, step1: state.step1, revision: 1, history: state.history });
  await notifyLeave(leave, "submitted", session);
  return leave.toObject();
}

/** The caller's own leave (by linked employee), or a 404. */
async function ownLeave(session, id) {
  const lid = oid(id);
  const emp = await getOwnEmployee(session, "_id");
  const leave = lid && emp ? await Leave.findById(lid) : null;
  if (!leave || String(leave.employeeId) !== String(emp._id)) throw new LeaveError("ไม่พบใบลา", 404);
  return leave;
}

/** Owner, `returned` only: same checks as submit; approvals cleared; revision + 1. */
export async function resubmitLeave(session, id, body) {
  const leave = await ownLeave(session, id);
  if (leave.status !== "returned") throw new LeaveError("ส่งใหม่ได้เฉพาะใบลาที่ถูกส่งกลับให้แก้ไข", 409);
  const { fields, auto } = await prepareLeave(session, body, { existing: leave });
  const revision = (leave.revision || 1) + 1;
  const state = submissionState("resubmitted", session.user.id, auto, revision);
  leave.set({ ...fields, status: state.status, step1: state.step1, step1Ack: null, hrStep: null, returnInfo: null, revision });
  leave.history.push(...state.history);
  await leave.save();
  await notifyLeave(leave, "submitted", session);
  return leave.toObject();
}

/** Owner, before final approval: → cancelled, no approval needed. */
export async function withdrawLeave(session, id, { note = "" } = {}) {
  const leave = await ownLeave(session, id);
  if (!WITHDRAWABLE_STATUSES.includes(leave.status)) throw new LeaveError("ยกเลิกเองได้เฉพาะใบลาที่ยังไม่อนุมัติขั้นสุดท้าย", 409);
  leave.status = "cancelled";
  leave.withdrawnAt = new Date();
  leave.history.push({ action: "withdrawn", byUserId: session.user.id, at: leave.withdrawnAt, note: String(note || "").trim().slice(0, 500), revision: leave.revision || 1 });
  await leave.save();
  return leave.toObject();
}

export function leaveErrorResponse(e, tag) {
  if (e instanceof LeaveError) return { body: { ok: false, message: e.message, field: e.field }, status: e.status };
  console.error(`[leave][${tag}]`, e?.message);
  return { body: { ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, status: 500 };
}

/* ── the ขอลา page ──────────────────────────────────────────── */

/**
 * Everything the ขอลา page needs, serialised. `leaveId`: ?id= — the owner's
 * `returned` leave to edit and resubmit; anything else gives `editNotice`.
 */
export async function buildRequestContext(session, { leaveId = null } = {}) {
  const emp = await getOwnEmployee(session, null);
  if (!emp) return { linked: false };

  const settings = await getLeaveSettings();
  const hoursPerDay = hoursPerDayOf(settings);
  const startMonth = settings.fiscalYearStartMonth || 1;
  const fy = currentFiscalYear(settings);
  const fiscalYears = [fy - 1, fy, fy + 1];

  let editing = null;
  let editNotice = null;
  if (leaveId) {
    const l = oid(leaveId) ? await Leave.findById(oid(leaveId)).lean() : null;
    if (!l || String(l.employeeId) !== String(emp._id)) editNotice = "ไม่พบใบลานี้";
    else if (l.status !== "returned") editNotice = "ใบลานี้ไม่ได้อยู่ในสถานะส่งกลับแก้ไข จึงแก้ไขไม่ได้";
    else editing = l;
  }

  const [typesRaw, dept, path, signers, saved, lastLeave] = await Promise.all([
    LeaveType.find({ isActive: { $ne: false } }).sort({ sortOrder: 1, nameTh: 1 }).lean(),
    emp.departmentId ? Department.findById(emp.departmentId).select("name code").lean() : null,
    approvalPathOf(emp),
    hrSignerNames(settings),
    getSignature(emp._id),
    lastApprovedLeave(emp._id, { excludeLeaveId: editing?._id }),
  ]);
  const quotas = await quotaSummary(emp._id, fiscalYears, typesRaw, { excludeLeaveId: editing?._id });

  // Holidays over the three fiscal years the page can pick dates in.
  const holidays = await listHolidaysBetween(`${fy - 1}-${String(startMonth).padStart(2, "0")}-01`, `${fy + 2}-12-31`);

  return {
    linked: true,
    employee: {
      name: nameOf(emp),
      position: (emp.position || "").trim(),
      department: dept?.name || emp.department || "",
      phone: (emp.phone || "").trim(),
    },
    settings: {
      hoursPerDay,
      weeklyDaysOff: weeklyDaysOffOf(settings),
      fiscalYearStartMonth: startMonth,
      halfDayMorning: settings.halfDayMorning,
      halfDayAfternoon: settings.halfDayAfternoon,
    },
    currentFiscalYear: fy,
    types: typesRaw.map((t) => ({
      _id: String(t._id),
      nameTh: t.nameTh,
      units: t.units || [],
      requiresAttachmentFromDays: t.requiresAttachmentFromDays ?? null,
    })),
    quotas,
    holidays: holidays.map(({ date, name }) => ({ date, name })),
    approval: { mode: path.mode, approvers: path.approvers, hrSigners: signers },
    profileSignature: saved?.png || null,
    lastLeave: lastLeave
      ? { ...lastLeave, startDate: dateKeyOf(lastLeave.startDate), endDate: dateKeyOf(lastLeave.endDate) }
      : null,
    editNotice,
    editing: editing
      ? {
          _id: String(editing._id),
          revision: editing.revision || 1,
          leaveTypeId: editing.leaveTypeId ? String(editing.leaveTypeId) : "",
          unit: editing.unit || "full_day",
          startDate: dateKeyOf(editing.startDate),
          endDate: dateKeyOf(editing.endDate),
          halfDayPeriod: editing.halfDayPeriod || "morning",
          startTime: editing.startTime || "",
          endTime: editing.endTime || "",
          reason: editing.reason || "",
          contactDuringLeave: editing.contactDuringLeave || "",
          attachments: (editing.attachments || []).map((a) => ({ url: a.url, publicId: a.publicId || "", name: a.name || "ไฟล์แนบ", type: a.type || "document", size: a.size || 0 })),
          returnInfo: editing.returnInfo
            ? {
                step: editing.returnInfo.step || 1,
                byName: editing.returnInfo.byName || "",
                at: editing.returnInfo.at ? new Date(editing.returnInfo.at).toISOString() : null,
                reason: editing.returnInfo.reason || "",
              }
            : null,
        }
      : null,
  };
}
