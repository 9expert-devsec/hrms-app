import "server-only";
import mongoose from "mongoose";
import Leave from "@/models/Leave";
import LeaveType from "@/models/LeaveType";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";
import { canAccess } from "@/lib/rbac/access";
import { canSeeLeaveDocument } from "@/lib/rbac/leaveScope";
import { getSignature } from "@/lib/offsite";
import LeaveSettings from "@/models/LeaveSettings";
import { FORM_CATEGORIES } from "@/lib/leaveRules";
import { EMPLOYEE_NAME_FIELDS, employeeDisplayName, employeeFullNameTh } from "@/lib/employeeName";
import { normalizePhotoCrop } from "@/lib/photoCrop";
import { signaturePngError } from "@/lib/signaturePng";
import { HOURS_PER_DAY, dateKeyOf } from "@/lib/leave/countLeave";
import { LeaveError, quotaSummary } from "@/lib/leave/requests";
import { notifyLeave } from "@/lib/leave/notify";

/**
 * Leave approval (QF-HRD-001), round 41. Callers must have called dbConnect().
 *
 *   pending_approval ─ approver (1) or (2), the FIRST to act decides ─┐
 *        approve → pending_hr; the other approver gets a รับทราบ task │
 *        return  → returned (reason required)                         │
 *   pending_hr ─ an HR signer (ตั้งค่าการลา) ─ approve → approved      │
 *                                             return  → returned       │
 *   รับทราบ never blocks HR; it stays open after `approved`, and closes
 *   when the leave is returned or cancelled.
 *
 * Every write is ONE conditional update on the expected status (and the
 * revision the caller saw), so a double click or two approvers acting at
 * once apply once; the loser gets 409.
 */

export const ALREADY_ACTED = "ใบลานี้ถูกดำเนินการไปแล้ว";
export const NO_HR_SIGNER = "ยังไม่ได้ตั้งผู้ลงนามฝ่ายบุคคล — ตั้งได้ที่ ตั้งค่าการลา";
const NOTE_MAX = 1000;
/** Statuses in which an open รับทราบ task may still be done. */
const ACK_OPEN_STATUSES = ["pending_hr", "approved", "cancel_requested"];
const ACTED_ACTIONS = ["approved_step1", "acknowledged", "approved_hr", "returned"];
export const ROLE_LABELS = { approver1: "ผู้อนุมัติ (1)", approver2: "ผู้อนุมัติ (2)", acknowledger: "ผู้รับทราบ", hr: "ฝ่ายบุคคล" };

const oid = (v) => (v && mongoose.isValidObjectId(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null);
const str = (v) => (v == null ? "" : String(v));
const nameOf = (emp) => (emp ? employeeFullNameTh(emp) || employeeDisplayName(emp) || "-" : "");
const hoursPerDayOf = (s) => (Number(s?.hoursPerDay) > 0 ? Number(s.hoursPerDay) : HOURS_PER_DAY);
const iso = (d) => (d ? new Date(d).toISOString() : null);

/* ── who is acting ──────────────────────────────────────────── */

/**
 * The caller's employee, the settings and the HR signer ids (strings). A
 * plain read (no seeding): the inbox badge calls this on every poll.
 */
async function viewerOf(session) {
  const [emp, settings] = await Promise.all([
    getOwnEmployee(session, `_id ${EMPLOYEE_NAME_FIELDS}`),
    LeaveSettings.findOne({ key: "default" }).select("hrSigners hoursPerDay").lean(),
  ]);
  const signerIds = (settings?.hrSigners || []).map(str);
  return { emp, empId: emp ? str(emp._id) : "", settings: settings || {}, signerIds, isSigner: !!emp && signerIds.includes(str(emp._id)) };
}

/** The caller's role at step 1 of this leave: approver1 | approver2 | null. */
function step1RoleOf(leave, empId) {
  if (!empId) return null;
  if (str(leave.approver1Id) === empId) return "approver1";
  if (str(leave.approver2Id) === empId) return "approver2";
  return null;
}

/**
 * A5 — may this HR signer sign the HR step of this leave? Only one place
 * decides it. Someone else's leave: yes. Their own leave: only when no other
 * HR signer exists, and it is then marked as self-approval (อนุมัติตนเอง).
 */
export function hrSelfApproval({ actorEmpId, ownerEmpId, signerIds }) {
  if (str(actorEmpId) !== str(ownerEmpId)) return { allowed: true, self: false };
  const others = signerIds.filter((id) => id !== str(actorEmpId));
  return others.length ? { allowed: false, self: true } : { allowed: true, self: true };
}

/** The actor's signature: the profile one, or a drawn one when none is saved. */
async function actorSignature(empId, drawn) {
  const saved = await getSignature(empId);
  if (saved?.png) return saved.png;
  if (!drawn) throw new LeaveError("กรุณาลงลายเซ็นก่อน", 400, "signature");
  const err = signaturePngError(drawn);
  if (err) throw new LeaveError(err, 400, "signature");
  return drawn;
}

function cleanNote(note, { required = false } = {}) {
  const v = String(note || "").trim();
  if (required && !v) throw new LeaveError("กรุณาระบุเหตุผลที่ไม่อนุมัติ", 400, "note");
  if (v.length > NOTE_MAX) throw new LeaveError(`เหตุผลยาวเกิน ${NOTE_MAX} ตัวอักษร`, 400, "note");
  return v;
}

async function loadLeave(id) {
  const lid = oid(id);
  const leave = lid ? await Leave.findById(lid).lean() : null;
  if (!leave) throw new LeaveError("ไม่พบใบลา", 404);
  return leave;
}

/**
 * The conditional update: applies only while the leave still has `status`
 * (and `revision`, when the caller sent the one it saw). null → 409.
 */
async function applyOnce(leave, filter, update, revision) {
  const q = { _id: leave._id, ...filter };
  if (Number.isInteger(revision)) q.revision = revision;
  const doc = await Leave.findOneAndUpdate(q, update, { new: true, runValidators: false });
  if (!doc) throw new LeaveError(ALREADY_ACTED, 409);
  return doc;
}

const revisionOf = (body) => (Number.isInteger(Number(body?.revision)) && body?.revision !== "" && body?.revision != null ? Number(body.revision) : undefined);

/* ── actions ────────────────────────────────────────────────── */

/** Step 1: approver (1) or (2). decision: approved | returned. */
export async function decideStep1(session, id, body = {}) {
  const leave = await loadLeave(id);
  const { emp, empId } = await viewerOf(session);
  const role = step1RoleOf(leave, empId);
  if (!role) throw new LeaveError("คุณไม่ใช่ผู้อนุมัติของใบลานี้", 403);
  if (str(leave.employeeId) === empId) throw new LeaveError("อนุมัติใบลาของตนเองไม่ได้", 403);
  const decision = body.decision === "returned" ? "returned" : body.decision === "approved" ? "approved" : null;
  if (!decision) throw new LeaveError("คำสั่งไม่ถูกต้อง", 400);
  if (leave.status !== "pending_approval") throw new LeaveError(ALREADY_ACTED, 409);
  const note = cleanNote(body.note, { required: decision === "returned" });
  const signature = await actorSignature(emp._id, body.signature);

  const at = new Date();
  const actor = { employeeId: emp._id, userId: oid(session.user.id), name: nameOf(emp), signature, note, at };
  const rev = leave.revision || 1;
  let set;
  let entry;
  if (decision === "approved") {
    // The other approver acknowledges — none when there is only one person.
    const otherId = role === "approver1" ? leave.approver2Id : leave.approver1Id;
    const other = otherId && str(otherId) !== empId ? await Employee.findById(otherId).select(EMPLOYEE_NAME_FIELDS).lean() : null;
    set = {
      status: "pending_hr",
      step1: { ...actor, role, decision },
      step1Ack: other ? { expectedBy: other._id, expectedRole: role === "approver1" ? "approver2" : "approver1", name: nameOf(other), at: null } : null,
    };
    entry = { action: "approved_step1", byUserId: actor.userId, at, note, revision: rev, step: 1 };
  } else {
    set = {
      status: "returned",
      step1: { ...actor, role, decision },
      returnInfo: { step: 1, byUserId: actor.userId, byName: actor.name, at, reason: note },
    };
    entry = { action: "returned", byUserId: actor.userId, at, note, revision: rev, step: 1 };
  }
  const doc = await applyOnce(leave, { status: "pending_approval" }, { $set: set, $push: { history: entry } }, revisionOf(body));
  await notifyLeave(doc, decision === "approved" ? "step1_approved" : "returned", session);
  return doc.toObject();
}

/** รับทราบ by the other approver. Allowed after HR; not once returned / cancelled. */
export async function acknowledgeLeave(session, id, body = {}) {
  const leave = await loadLeave(id);
  const { emp, empId } = await viewerOf(session);
  if (!empId || str(leave.step1Ack?.expectedBy) !== empId) throw new LeaveError("ไม่มีงานรับทราบของคุณในใบลานี้", 403);
  if (leave.step1Ack?.at) throw new LeaveError(ALREADY_ACTED, 409);
  if (!ACK_OPEN_STATUSES.includes(leave.status)) throw new LeaveError("ใบลานี้ถูกส่งกลับหรือยกเลิกแล้ว จึงรับทราบไม่ได้", 409);
  const signature = await actorSignature(emp._id, body.signature);
  const at = new Date();
  const userId = oid(session.user.id);
  const doc = await applyOnce(
    leave,
    { status: { $in: ACK_OPEN_STATUSES }, "step1Ack.expectedBy": emp._id, "step1Ack.at": null },
    {
      $set: { "step1Ack.employeeId": emp._id, "step1Ack.userId": userId, "step1Ack.name": nameOf(emp), "step1Ack.signature": signature, "step1Ack.at": at },
      $push: { history: { action: "acknowledged", byUserId: userId, at, note: "", revision: leave.revision || 1 } },
    },
    revisionOf(body)
  );
  return doc.toObject();
}

/** HR step: an HR signer only. decision: approved | returned. */
export async function decideHr(session, id, body = {}) {
  const leave = await loadLeave(id);
  const { emp, empId, signerIds, isSigner } = await viewerOf(session);
  if (!signerIds.length) throw new LeaveError(NO_HR_SIGNER, 403);
  if (!isSigner) throw new LeaveError("เฉพาะผู้ลงนามฝ่ายบุคคลที่กำหนดใน ตั้งค่าการลา ดำเนินการขั้นนี้ได้", 403);
  const self = hrSelfApproval({ actorEmpId: empId, ownerEmpId: leave.employeeId, signerIds });
  if (!self.allowed) throw new LeaveError("ใบลาของคุณเองต้องให้ผู้ลงนามฝ่ายบุคคลคนอื่นดำเนินการ", 403);
  const decision = body.decision === "returned" ? "returned" : body.decision === "approved" ? "approved" : null;
  if (!decision) throw new LeaveError("คำสั่งไม่ถูกต้อง", 400);
  if (leave.status !== "pending_hr") throw new LeaveError(ALREADY_ACTED, 409);
  const note = cleanNote(body.note, { required: decision === "returned" });
  const signature = await actorSignature(emp._id, body.signature);

  const at = new Date();
  const userId = oid(session.user.id);
  const hrStep = { employeeId: emp._id, userId, name: nameOf(emp), signature, note, at, role: "hr", decision, selfApproved: self.self && decision === "approved" };
  const set = decision === "approved"
    ? { status: "approved", hrStep }
    : { status: "returned", hrStep, returnInfo: { step: 2, byUserId: userId, byName: hrStep.name, at, reason: note } };
  const entry = decision === "approved"
    ? { action: "approved_hr", byUserId: userId, at, note, revision: leave.revision || 1, step: 2, selfApproved: hrStep.selfApproved }
    : { action: "returned", byUserId: userId, at, note, revision: leave.revision || 1, step: 2 };
  const doc = await applyOnce(leave, { status: "pending_hr" }, { $set: set, $push: { history: entry } }, revisionOf(body));
  await notifyLeave(doc, decision === "approved" ? "hr_approved" : "returned", session);
  return doc.toObject();
}

/* ── lists ──────────────────────────────────────────────────── */

export const APPROVAL_TABS = ["approve", "acknowledge", "hr", "done"];

function tabQuery(tab, v, userId) {
  const me = oid(v.empId);
  if (tab === "approve") return me ? { status: "pending_approval", $or: [{ approver1Id: me }, { approver2Id: me }], employeeId: { $ne: me } } : null;
  if (tab === "acknowledge") return me ? { status: { $in: ACK_OPEN_STATUSES }, "step1Ack.expectedBy": me, "step1Ack.at": null } : null;
  if (tab === "hr") return v.isSigner ? { status: "pending_hr" } : null;
  if (tab === "done") {
    const uid = oid(userId);
    return uid ? { history: { $elemMatch: { byUserId: uid, action: { $in: ACTED_ACTIONS } } } } : null;
  }
  return null;
}

/** Badge counts for the caller: { approve, acknowledge, hr }. */
export async function approvalCounts(session) {
  const v = await viewerOf(session);
  const out = { approve: 0, acknowledge: 0, hr: 0 };
  await Promise.all(
    ["approve", "acknowledge", "hr"].map(async (t) => {
      const q = tabQuery(t, v, session.user.id);
      out[t] = q ? await Leave.countDocuments(q) : 0;
    })
  );
  return out;
}

/** Which tabs this user has (a tab that is always empty is left out) + counts. */
export async function approvalTabs(session) {
  const v = await viewerOf(session);
  const counts = { approve: 0, acknowledge: 0, hr: 0 };
  for (const t of ["approve", "acknowledge", "hr"]) {
    const q = tabQuery(t, v, session.user.id);
    counts[t] = q ? await Leave.countDocuments(q) : 0;
  }
  const mapped = v.emp
    ? !!(await Employee.exists({ $or: [{ leaveApprover1Id: v.emp._id }, { leaveApprover2Id: v.emp._id }] }))
    : false;
  const tabs = [];
  if (mapped || counts.approve) tabs.push("approve");
  if (mapped || counts.acknowledge) tabs.push("acknowledge");
  if (v.isSigner) tabs.push("hr");
  tabs.push("done");
  return { tabs, counts, isSigner: v.isSigner, noSigner: !v.signerIds.length, linked: !!v.emp };
}

const LIST_EMP_FIELDS = `_id ${EMPLOYEE_NAME_FIELDS} position department departmentId photoUrl photoCrop empAutoId`;

async function employeesById(ids) {
  const emps = await Employee.find({ _id: { $in: ids } }).select(LIST_EMP_FIELDS).lean();
  const deptIds = emps.map((e) => e.departmentId).filter(Boolean);
  const codes = emps.map((e) => e.department).filter(Boolean);
  const depts = await Department.find({ $or: [{ _id: { $in: deptIds } }, { code: { $in: codes } }] }).select("_id code name").lean();
  const deptOf = (e) => depts.find((d) => (e.departmentId && str(d._id) === str(e.departmentId)) || (!e.departmentId && d.code === e.department));
  return new Map(
    emps.map((e) => [
      str(e._id),
      {
        _id: str(e._id),
        name: nameOf(e),
        position: (e.position || "").trim(),
        department: deptOf(e)?.name || e.department || "",
        code: e.empAutoId ? String(e.empAutoId) : "",
        photoUrl: e.photoUrl || null,
        photoCrop: normalizePhotoCrop(e.photoCrop),
      },
    ])
  );
}

/** The caller's role on a leave for one tab (the chip on the card). */
function roleOn(tab, leave, v, userId) {
  if (tab === "approve") return step1RoleOf(leave, v.empId);
  if (tab === "acknowledge") return "acknowledger";
  if (tab === "hr") return "hr";
  const mine = (leave.history || []).filter((h) => str(h.byUserId) === str(userId) && ACTED_ACTIONS.includes(h.action)).pop();
  if (!mine) return null;
  if (mine.action === "acknowledged") return "acknowledger";
  if (mine.action === "approved_hr" || (mine.action === "returned" && mine.step === 2)) return "hr";
  return step1RoleOf(leave, v.empId) || "approver1";
}

function submittedAt(leave) {
  const subs = (leave.history || []).filter((h) => h.action === "submitted" || h.action === "resubmitted");
  return subs.length ? subs[subs.length - 1].at : leave.createdAt;
}

function listItem(leave, emp, role) {
  return {
    _id: str(leave._id),
    employee: emp || { name: "-", department: "", photoUrl: null, photoCrop: null },
    leaveTypeName: leave.leaveTypeName || "-",
    unit: leave.unit || "full_day",
    startDate: dateKeyOf(leave.startDate),
    endDate: dateKeyOf(leave.endDate),
    halfDayPeriod: leave.halfDayPeriod || null,
    startTime: leave.startTime || null,
    endTime: leave.endTime || null,
    totalHours: leave.totalHours ?? (leave.totalDays || 0) * HOURS_PER_DAY,
    status: leave.status,
    revision: leave.revision || 1,
    submittedAt: iso(submittedAt(leave)),
    myRole: role,
  };
}

/** GET ?tab= — the caller's list for one tab (newest first for `done`). */
export async function listApprovals(session, tab) {
  if (!APPROVAL_TABS.includes(tab)) throw new LeaveError("แท็บไม่ถูกต้อง", 400);
  const v = await viewerOf(session);
  const q = tabQuery(tab, v, session.user.id);
  if (!q) return { items: [], hoursPerDay: hoursPerDayOf(v.settings) };
  const leaves = await Leave.find(q)
    .select("employeeId leaveTypeName unit startDate endDate halfDayPeriod startTime endTime totalHours totalDays status revision history createdAt updatedAt approver1Id approver2Id")
    .sort(tab === "done" ? { updatedAt: -1 } : { createdAt: 1 })
    .limit(tab === "done" ? 100 : 500)
    .lean();
  const emps = await employeesById([...new Set(leaves.map((l) => str(l.employeeId)))]);
  return {
    items: leaves.map((l) => listItem(l, emps.get(str(l.employeeId)), roleOn(tab, l, v, session.user.id))),
    hoursPerDay: hoursPerDayOf(v.settings),
  };
}

/* ── one leave ──────────────────────────────────────────────── */

/**
 * HR stats "สถิติการลาในปีงบประมาณนี้": the requester's APPROVED hours in
 * the leave's fiscal year per form category (other types → อื่นๆ), this
 * leave excluded; plus this leave in its own row.
 */
async function fiscalYearStats(leave) {
  const rows = Object.fromEntries(FORM_CATEGORIES.map((c) => [c, { before: 0, now: 0 }]));
  if (leave.fiscalYear != null) {
    const sums = await Leave.aggregate([
      { $match: { employeeId: leave.employeeId, fiscalYear: leave.fiscalYear, status: "approved", _id: { $ne: leave._id } } },
      { $group: { _id: "$leaveType", hours: { $sum: "$totalHours" } } },
    ]);
    for (const s of sums) rows[FORM_CATEGORIES.includes(s._id) ? s._id : "other"].before += s.hours || 0;
  }
  rows[FORM_CATEGORIES.includes(leave.leaveType) ? leave.leaveType : "other"].now = leave.totalHours || 0;
  return FORM_CATEGORIES.map((c) => ({ category: c, before: rows[c].before, now: rows[c].now, total: rows[c].before + rows[c].now }));
}

/** May the caller open this leave on the approval page? */
async function canViewApproval(session, leave, v) {
  if (step1RoleOf(leave, v.empId)) return true;
  if (v.empId && str(leave.step1Ack?.expectedBy) === v.empId) return true;
  if (v.isSigner) return true;
  if ((leave.history || []).some((h) => str(h.byUserId) === str(session.user.id) && ACTED_ACTIONS.includes(h.action))) return true;
  const owner = await Employee.findById(leave.employeeId).select("_id departmentId department").lean();
  return canSeeLeaveDocument(session, { ownerUserId: leave.userId, employee: owner });
}

const stepOut = (s) =>
  s
    ? {
        name: s.name || "",
        role: s.role || null,
        decision: s.decision || null,
        at: iso(s.at),
        note: s.note || "",
        auto: !!s.auto,
        selfApproved: !!s.selfApproved,
        expectedName: s.expectedBy ? s.name || "" : "",
        expectedRole: s.expectedRole || null,
        done: !!s.at && !!s.employeeId,
      }
    : null;

/** Everything the detail panel needs, serialised, plus the caller's actions. */
export async function approvalDetail(session, id) {
  const leave = await loadLeave(id);
  const v = await viewerOf(session);
  if (!(await canViewApproval(session, leave, v))) throw new LeaveError("ไม่พบใบลา", 404);
  const hoursPerDay = hoursPerDayOf(v.settings);

  const approverIds = [leave.approver1Id, leave.approver2Id].filter(Boolean).map(str);
  const [emps, signers, type] = await Promise.all([
    employeesById([str(leave.employeeId), ...approverIds]),
    Employee.find({ _id: { $in: v.signerIds } }).select(EMPLOYEE_NAME_FIELDS).lean(),
    leave.leaveTypeId ? LeaveType.findById(leave.leaveTypeId).lean() : null,
  ]);

  // คงเหลือ X → Y: the quota minus APPROVED hours (this leave excluded).
  let quota = null;
  if (type && leave.fiscalYear != null) {
    const q = (await quotaSummary(leave.employeeId, [leave.fiscalYear], [type], { excludeLeaveId: leave._id }))[leave.fiscalYear][str(type._id)];
    if (q.quotaDays !== null) {
      const before = q.quotaDays * hoursPerDay - q.usedHours;
      quota = { before, after: before - (leave.totalHours || 0) };
    }
  }

  const role = step1RoleOf(leave, v.empId);
  const ackOpen = !!v.empId && str(leave.step1Ack?.expectedBy) === v.empId && !leave.step1Ack?.at && ACK_OPEN_STATUSES.includes(leave.status);
  const self = v.isSigner ? hrSelfApproval({ actorEmpId: v.empId, ownerEmpId: leave.employeeId, signerIds: v.signerIds }) : { allowed: false, self: false };
  const actions = {
    step1: leave.status === "pending_approval" && !!role && str(leave.employeeId) !== v.empId ? role : null,
    acknowledge: ackOpen,
    hr: leave.status === "pending_hr" && v.isSigner && self.allowed,
    hrSelf: leave.status === "pending_hr" && v.isSigner && self.allowed && self.self,
  };
  const anyAction = !!(actions.step1 || actions.acknowledge || actions.hr);
  const profileSignature = anyAction && v.emp ? !!(await getSignature(v.emp._id))?.png : false;

  return {
    hoursPerDay,
    leave: {
      ...listItem(leave, emps.get(str(leave.employeeId)), null),
      fiscalYear: leave.fiscalYear ?? null,
      reason: leave.reason || "",
      contactDuringLeave: leave.contactDuringLeave || "",
      excludedDates: (leave.excludedDates || []).map((x) => ({ date: dateKeyOf(x.date), reason: x.reason || "" })),
      lastLeave: leave.lastLeaveSnapshot
        ? { ...leave.lastLeaveSnapshot, startDate: dateKeyOf(leave.lastLeaveSnapshot.startDate), endDate: dateKeyOf(leave.lastLeaveSnapshot.endDate) }
        : null,
      attachments: (leave.attachments || []).map((a) => ({ url: a.url, name: a.name || "ไฟล์แนบ", type: a.type || "document", size: a.size || 0 })),
      autoApproved: !!leave.autoApproved,
      approvers: approverIds.map((aid, i) => ({ role: i === 0 ? "approver1" : "approver2", name: emps.get(aid)?.name || "-" })),
      step1: stepOut(leave.step1),
      ack: stepOut(leave.step1Ack),
      hr: stepOut(leave.hrStep),
      returnInfo: leave.returnInfo ? { step: leave.returnInfo.step, byName: leave.returnInfo.byName || "", at: iso(leave.returnInfo.at), reason: leave.returnInfo.reason || "" } : null,
      withdrawnAt: iso(leave.withdrawnAt),
    },
    quota,
    hrSigners: signers.map(nameOf),
    noSigner: !v.signerIds.length,
    viewerName: v.emp ? nameOf(v.emp) : "",
    stats: v.isSigner || canAccess(session.user, "scope_leave_hr_step") ? await fiscalYearStats(leave) : null,
    actions,
    profileSignature,
  };
}
