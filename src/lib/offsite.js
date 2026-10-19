import "server-only";
import mongoose from "mongoose";
import OffsiteRequest from "@/models/OffsiteRequest";
import EmployeeSignature from "@/models/EmployeeSignature";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import Counter from "@/models/Counter";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";
import { HEAD_FIELDS } from "@/lib/hod";
import { EMPLOYEE_NAME_FIELDS, employeeDisplayName, employeeFullNameTh } from "@/lib/employeeName";
import {
  ACCOUNTING_DEPT_CODE,
  ACTIVE_APPROVAL_STATUSES,
  HR_DEPT_CODE,
  MEMBER_STATUS_LABELS,
  SELF_APPROVAL_LABEL,
  STATUS_LABELS,
  activeStepOf,
  allowanceNeedsAmount,
  detailsKey,
  parseWorkDate,
  progressOf,
  validateHrSummary,
  validateOffsiteInput,
  workDateInput,
} from "@/lib/offsiteRules";

/**
 * Off-site work requests — the ONE write path. Every action checks who the
 * caller is, checks the status machine (an illegal transition is a 409) and
 * appends to `events`. Callers must have called dbConnect() first.
 *
 *   draft ──send──▶ inviting ──all accepted──▶ members_ready ──step 1──▶ in_approval
 *     ▲               │ any decline                                  step 2 (AC head)
 *     │               ▼                                              step 3 (HR head + HR section)
 *     └─(edit)── returned ◀──────────── reject at step 2 / 3 ───────────┘   └─▶ approved
 *   anything before approved ──cancel──▶ cancelled
 *
 * Resend after a return (sendInvitations):
 *   - member set changed → new members invited; every step that had moved
 *     becomes needs_resign (step 1 included) and signs afresh in order;
 *   - members unchanged  → approved steps become needs_reconfirm (step 1 is
 *     reconfirmed by the resend itself); the rejecting step signs afresh.
 *
 * Head lookup is injectable: write functions take `opts.resolveHead(code)`
 * (default resolveDepartmentHead). The app never passes it; it exists so a
 * node test can approve as test employees instead of the real heads.
 */

/** Thrown for refused actions; `status` is the HTTP status, `extra` goes into the JSON body. */
export class OffsiteError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Which statuses each action may start from. */
const ALLOWED_FROM = {
  update: ["draft", "returned"],
  send: ["draft", "returned"],
  respond: ["inviting"],
  submit: ["members_ready"],
  decide: ["in_approval"], // approve / reject / reconfirm / HR section
  cancel: ["draft", "inviting", "members_ready", "in_approval", "returned"],
};

/** Department whose head signs each step. */
const STEP_DEPT = { 2: ACCOUNTING_DEPT_CODE, 3: HR_DEPT_CODE };
const STEP_DEPT_LABEL = { 2: "ฝ่ายบัญชี", 3: "ฝ่ายบุคคล" };

const SIGNATURE_MAX_BYTES = 60 * 1024;
const PNG_DATA_URL_RE = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;
const VIEWER_FIELDS = `_id ${EMPLOYEE_NAME_FIELDS} position department departmentId userId`;
const LIST_PROJECTION = "-members.signature -approvals.signature -events -returnSnapshot";
const SNAPSHOT_FIELDS = ["jobName", "workDate", "startTime", "endTime", "description", "placeName", "address", "travelMode", "note", "leader"];

const str = (v) => (v == null ? "" : String(v));
const clean = (v) => (typeof v === "string" ? v.trim() : "");
const nameOf = (emp) => employeeFullNameTh(emp) || employeeDisplayName(emp);
const stepOf = (doc, n) => doc.approvals.find((a) => a.step === n);

function assertFrom(doc, action) {
  if (!ALLOWED_FROM[action].includes(doc.status)) {
    throw new OffsiteError(`ทำรายการนี้ไม่ได้ในสถานะปัจจุบัน (${STATUS_LABELS[doc.status] || doc.status})`, 409);
  }
}

function addEvent(doc, session, type, detail = "") {
  const by = mongoose.isValidObjectId(session?.user?.id) ? session.user.id : null;
  doc.events.push({ at: new Date(), by, type, detail });
}

async function save(doc) {
  try {
    await doc.save();
  } catch (e) {
    if (e instanceof mongoose.Error.VersionError) {
      throw new OffsiteError("คำขอนี้ถูกเปลี่ยนแปลงพร้อมกัน กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง", 409);
    }
    throw e;
  }
  return doc;
}

function requireReason(reason, what) {
  const why = clean(reason);
  if (!why) throw new OffsiteError(`กรุณาระบุเหตุผลที่${what}`, 400, { errors: { reason: `กรุณาระบุเหตุผลที่${what}` } });
  if (why.length > 500) throw new OffsiteError("เหตุผลยาวเกิน 500 ตัวอักษร", 400, { errors: { reason: "เหตุผลยาวเกิน 500 ตัวอักษร" } });
  return why;
}

/** The caller's own employee (with name/position fields); 403 for an unlinked account. */
export async function viewerEmployee(session) {
  const emp = await getOwnEmployee(session, VIEWER_FIELDS);
  if (!emp) throw new OffsiteError("บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน", 403);
  return emp;
}

/* ── signatures ─────────────────────────────────────────────── */

/** Normalized PNG data URL, or an OffsiteError (400). */
export function validateSignaturePng(png) {
  const m = typeof png === "string" ? png.match(PNG_DATA_URL_RE) : null;
  if (!m) throw new OffsiteError("ลายเซ็นต้องเป็นรูป PNG", 400);
  const bytes = Buffer.from(m[1], "base64");
  if (bytes.length > SIGNATURE_MAX_BYTES) throw new OffsiteError("ไฟล์ลายเซ็นใหญ่เกิน 60 KB", 400);
  if (bytes.length < 8 || bytes.readUInt32BE(0) !== 0x89504e47) throw new OffsiteError("ลายเซ็นต้องเป็นรูป PNG", 400);
  return png;
}

/** { png, updatedAt } of an employee's saved signature, or null. */
export async function getSignature(employeeId) {
  const sig = await EmployeeSignature.findOne({ employee: employeeId }).select("png updatedAt").lean();
  return sig ? { png: sig.png, updatedAt: sig.updatedAt } : null;
}

export async function saveSignature(employeeId, png) {
  const valid = validateSignaturePng(png);
  const sig = await EmployeeSignature.findOneAndUpdate(
    { employee: employeeId },
    { $set: { png: valid } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return { png: sig.png, updatedAt: sig.updatedAt };
}

async function requireSignature(employeeId) {
  const sig = await getSignature(employeeId);
  if (!sig?.png) {
    throw new OffsiteError("ยังไม่มีลายเซ็นที่บันทึกไว้ — กรุณาวาดและบันทึกลายเซ็นก่อน", 400, { needSignature: true });
  }
  return sig.png;
}

/* ── heads ─────────────────────────────────────────────────── */

/**
 * Default head lookup: Department(code).headOfDepartment, who must have a
 * login account. No guessing — a missing department, head or account is a
 * 409 naming the problem. Returns the head employee (HEAD_FIELDS).
 */
export async function resolveDepartmentHead(code) {
  const dept = await Department.findOne({ code })
    .select("_id code name headOfDepartment")
    .populate("headOfDepartment", HEAD_FIELDS)
    .lean();
  if (!dept) throw new OffsiteError(`ไม่พบแผนกรหัส ${code} ในระบบ — กรุณาติดต่อผู้ดูแลระบบ`, 409);
  const head = dept.headOfDepartment;
  if (!head) throw new OffsiteError(`แผนก${dept.name}ยังไม่ได้กำหนดหัวหน้าแผนก จึงส่งต่อเพื่ออนุมัติไม่ได้ — กรุณาแจ้ง HR ให้กำหนดหัวหน้าแผนกก่อน`, 409);
  if (!head.userId) {
    throw new OffsiteError(`หัวหน้าแผนก${dept.name} (${nameOf(head)}) ยังไม่มีบัญชีผู้ใช้ในระบบ จึงลงนามไม่ได้ — กรุณาแจ้ง HR`, 409);
  }
  return head;
}

async function headForStep(n, resolveHead) {
  const head = await resolveHead(STEP_DEPT[n]);
  if (!head?._id) throw new OffsiteError(`ไม่พบหัวหน้า${STEP_DEPT_LABEL[n]}ที่มีบัญชีผู้ใช้ — ส่งต่อเพื่ออนุมัติไม่ได้`, 409);
  return head;
}

const withDefaults = (opts = {}) => ({ resolveHead: opts.resolveHead || resolveDepartmentHead });

/* ── helpers ────────────────────────────────────────────────── */

/** OS-<พ.ศ.>-0001, numbered per Buddhist year (Counter `offsite-<year>`). */
async function nextDocNo() {
  const year = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok", year: "numeric" })) + 543;
  const counter = await Counter.findByIdAndUpdate(`offsite-${year}`, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
  return `OS-${year}-${String(counter.seq).padStart(4, "0")}`;
}

async function creatorSnapshot(emp) {
  let deptName = "";
  if (emp.departmentId) {
    const dept = await Department.findById(emp.departmentId).select("name").lean();
    deptName = dept?.name || "";
  }
  return {
    creatorNameTh: nameOf(emp),
    creatorPosition: emp.position || "",
    creatorDepartment: deptName || emp.department || "",
  };
}

/** Form input → validated plain fields (400 with field errors). */
function readInput(input, creatorId) {
  const { errors, memberErrors } = validateOffsiteInput(input, { creatorId });
  if (Object.keys(errors).length) {
    throw new OffsiteError("กรุณากรอกข้อมูลให้ครบถ้วน", 400, { errors, memberErrors });
  }
  return {
    jobName: clean(input.jobName),
    workDate: parseWorkDate(input.workDate),
    startTime: clean(input.startTime),
    endTime: clean(input.endTime),
    description: clean(input.description),
    placeName: clean(input.placeName),
    address: clean(input.address),
    travelMode: input.travelMode,
    note: clean(input.note),
  };
}

/**
 * Members from the (validated) form, creator first. Existing entries keep
 * their answer; an accepted member whose duty changed must accept again.
 */
async function buildMembers(inputMembers, creator, existing = []) {
  const wanted = new Map([[str(creator._id), ""]]); // creator first
  for (const m of inputMembers || []) {
    const id = str(m?.employee);
    if (!mongoose.isValidObjectId(id)) throw new OffsiteError("รหัสพนักงานไม่ถูกต้อง", 400);
    wanted.set(id, clean(m?.duty));
  }

  const ids = [...wanted.keys()];
  const emps = await Employee.find({ _id: { $in: ids } }).select(`_id ${EMPLOYEE_NAME_FIELDS}`).lean();
  if (emps.length !== ids.length) throw new OffsiteError("ไม่พบพนักงานบางคนที่เลือก", 400, { errors: { members: "ไม่พบพนักงานบางคนที่เลือก" } });
  const byId = new Map(emps.map((e) => [str(e._id), e]));
  const old = new Map(existing.map((m) => [str(m.employee), m.toObject ? m.toObject() : m]));

  return ids.map((id) => {
    const duty = wanted.get(id);
    const prev = old.get(id);
    const base = { employee: id, nameSnapshot: nameOf(byId.get(id)), duty };
    if (!prev) return { ...base, status: "invited", signature: "", respondedAt: null, declineReason: "", invitedInRevision: null };
    if (prev.status === "accepted" && prev.duty !== duty && id !== str(creator._id)) {
      return { ...base, status: "invited", signature: "", respondedAt: null, declineReason: "", invitedInRevision: null };
    }
    return { ...prev, ...base };
  });
}

/** Is this employee the creator or a member of the request? */
function inRequest(doc, empId) {
  const me = str(empId);
  return str(doc.createdBy) === me || (doc.members || []).some((m) => str(m.employee) === me);
}

function canRead(doc, empId, user) {
  if (user?.isSuperadmin === true) return true;
  const me = str(empId);
  if (!me) return false;
  if (inRequest(doc, me)) return true;
  if ((doc.pastApprovers || []).some((id) => str(id) === me)) return true;
  return (doc.approvals || []).some((a) => str(a.approver) === me);
}

async function loadOwn(session, id) {
  if (!mongoose.isValidObjectId(id)) throw new OffsiteError("ไม่พบคำขอ", 404);
  const [doc, emp] = await Promise.all([OffsiteRequest.findById(id), viewerEmployee(session)]);
  if (!doc) throw new OffsiteError("ไม่พบคำขอ", 404);
  if (!canRead(doc, emp._id, session.user)) throw new OffsiteError("ไม่มีสิทธิ์เข้าถึงคำขอนี้", 403);
  return { doc, emp, isCreator: str(doc.createdBy) === str(emp._id) };
}

function requireCreator(isCreator) {
  if (!isCreator) throw new OffsiteError("เฉพาะผู้สร้างคำขอเท่านั้นที่ทำรายการนี้ได้", 403);
}

function allAccepted(doc) {
  return doc.members.length > 0 && doc.members.every((m) => m.status === "accepted");
}

function addPastApprover(doc, empId) {
  if (!doc.pastApprovers.some((id) => str(id) === str(empId))) doc.pastApprovers.push(empId);
}

/* ── returns & resubmits ───────────────────────────────────── */

/** Details + members as they are now, kept while the request is returned. */
function takeSnapshot(doc) {
  const r = doc.toObject();
  const details = Object.fromEntries(SNAPSHOT_FIELDS.map((k) => [k, k === "workDate" ? workDateInput(r.workDate) : k === "leader" ? str(r.leader) : r[k] ?? ""]));
  return {
    revision: r.revision,
    details,
    members: r.members.map((m) => ({ employee: str(m.employee), nameSnapshot: m.nameSnapshot, duty: m.duty })),
  };
}

function markReturned(doc, session, { step, byName, reason }) {
  doc.status = "returned";
  doc.returnInfo = { at: new Date(), step, byName, reason, revision: doc.revision };
  doc.returnSnapshot = takeSnapshot(doc);
  addEvent(doc, session, "returned", step ? `ขั้นที่ ${step}: ${reason}` : reason);
}

/** What changed since the snapshot: { fields, membersAdded, membersRemoved, memberSetChanged }. */
function diffSnapshot(snapshot, doc) {
  const now = takeSnapshot(doc);
  const fields = SNAPSHOT_FIELDS.filter((k) => str(snapshot.details?.[k]) !== str(now.details[k]));
  const before = new Map((snapshot.members || []).map((m) => [m.employee, m]));
  const after = new Map(now.members.map((m) => [m.employee, m]));
  const membersAdded = now.members.filter((m) => !before.has(m.employee)).map((m) => m.nameSnapshot);
  const membersRemoved = (snapshot.members || []).filter((m) => !after.has(m.employee)).map((m) => m.nameSnapshot);
  if (now.members.some((m) => before.has(m.employee) && clean(before.get(m.employee).duty) !== clean(m.duty))) fields.push("duties");
  return { fields, membersAdded, membersRemoved, memberSetChanged: membersAdded.length > 0 || membersRemoved.length > 0 };
}

const clearSign = { signature: "", signedAt: null, confirmedAt: null, reason: "", selfApproval: false };

/**
 * Approval steps on a resend after a return (see the header comment).
 * Steps that never moved ("waiting") stay waiting.
 */
function resetApprovals(doc, memberSetChanged, now) {
  for (const a of doc.approvals) {
    if (a.status === "waiting") continue;
    if (memberSetChanged) {
      a.set({ status: "needs_resign", ...clearSign });
    } else if (a.status === "approved") {
      if (a.step === 1) a.confirmedAt = now; // reconfirmed by the resend itself
      else a.status = "needs_reconfirm"; // signature kept
    } else if (a.status === "rejected" || a.status === "pending") {
      a.set({ status: "needs_resign", ...clearSign });
    }
  }
}

/**
 * Move to the next step after step 1 / an approval / a reconfirm: the first
 * step (2, 3) not approved becomes active — a needs_reconfirm step keeps its
 * approver; any other resolves its head now and becomes pending. None left
 * → the request is approved. Throws 409 (nothing saved) when a head cannot
 * be resolved.
 */
async function activateNext(doc, session, { resolveHead }) {
  for (const n of [2, 3]) {
    const a = stepOf(doc, n);
    if (a.status === "approved") continue;
    doc.status = "in_approval";
    if (a.status === "needs_reconfirm") {
      addEvent(doc, session, `step${n}_reconfirm_pending`, a.approverName);
      return;
    }
    const head = await headForStep(n, resolveHead);
    a.set({ approver: head._id, approverName: nameOf(head), status: "pending", ...clearSign });
    addEvent(doc, session, `step${n}_pending`, nameOf(head));
    return;
  }
  doc.status = "approved";
  addEvent(doc, session, "approved");
}

/** Everyone has accepted: step 1 still to sign → members_ready, else on to steps 2–3. */
async function afterMembersAccepted(doc, session, opts) {
  if (stepOf(doc, 1).status === "approved") {
    await activateNext(doc, session, opts);
  } else {
    doc.status = "members_ready";
    addEvent(doc, session, "members_ready");
  }
}

/* ── serialization ─────────────────────────────────────────── */

function serialize(doc) {
  const r = { ...(doc.toObject ? doc.toObject() : doc) };
  delete r.returnSnapshot; // internal
  return {
    ...r,
    _id: str(r._id),
    docNo: r.docNo || null,
    createdBy: str(r.createdBy),
    createdByUser: str(r.createdByUser),
    leader: r.leader ? str(r.leader) : null,
    members: (r.members || []).map((m) => ({ ...m, employee: str(m.employee) })),
    approvals: (r.approvals || []).map((a) => ({ ...a, approver: a.approver ? str(a.approver) : null })),
    pastApprovers: (r.pastApprovers || []).map(str),
    events: (r.events || []).map((e) => ({ ...e, by: e.by ? str(e.by) : null })),
    progress: progressOf(r),
    activeStep: activeStepOf(r),
  };
}

function viewerFlags(doc, empId, isCreator) {
  const me = str(empId);
  const mine = doc.members.find((m) => str(m.employee) === me) || null;
  const active = activeStepOf(doc);
  const a = active ? stepOf(doc, active) : null;
  const isActiveApprover = !!a && str(a.approver) === me;
  return {
    employeeId: me,
    isCreator,
    inRequest: inRequest(doc, me),
    memberStatus: mine?.status || null,
    canEdit: isCreator && ALLOWED_FROM.update.includes(doc.status),
    canSend: isCreator && ALLOWED_FROM.send.includes(doc.status),
    canRespond: !isCreator && doc.status === "inviting" && mine?.status === "invited",
    canSubmit: isCreator && doc.status === "members_ready",
    canCancel: isCreator && ALLOWED_FROM.cancel.includes(doc.status),
    activeStep: active,
    canApprove: isActiveApprover && a.status === "pending",
    canReconfirm: isActiveApprover && a.status === "needs_reconfirm",
    canReject: isActiveApprover,
    canEditHr: isActiveApprover && active === 3 && a.status === "pending",
  };
}

function result(doc, emp, isCreator) {
  return { request: serialize(doc), viewer: viewerFlags(doc, emp._id, isCreator) };
}

/* ── reads ─────────────────────────────────────────────────── */

export async function getRequest(session, id) {
  const { doc, emp, isCreator } = await loadOwn(session, id);
  return result(doc, emp, isCreator);
}

const activeApprovalMatch = (me) => ({
  status: "in_approval",
  approvals: { $elemMatch: { step: { $gte: 2 }, approver: me, status: { $in: ACTIVE_APPROVAL_STATUSES } } },
});
const invitesMatch = (me) => ({ status: "inviting", members: { $elemMatch: { employee: me, status: "invited" } }, createdBy: { $ne: me } });

/**
 * The caller's lists. `box`: "mine" (created by me), "invites" (waiting for
 * my answer), "member" (requests I am on, created by someone else),
 * "approvals" (the active step is mine), "approved_by_me" (I approved or
 * rejected a step at some point).
 */
export async function listRequests(session, box = "mine") {
  const emp = await viewerEmployee(session);
  const me = emp._id;
  const query =
    {
      invites: invitesMatch(me),
      member: { "members.employee": me, createdBy: { $ne: me } },
      approvals: activeApprovalMatch(me),
      approved_by_me: { pastApprovers: me },
    }[box] || { createdBy: me };
  const docs = await OffsiteRequest.find(query).select(LIST_PROJECTION).sort({ workDate: -1, createdAt: -1 }).limit(200).lean();
  return docs.map((d) => {
    const mine = (d.members || []).find((m) => str(m.employee) === str(me));
    const active = activeStepOf(d);
    return {
      _id: str(d._id),
      docNo: d.docNo || null,
      jobName: d.jobName,
      workDate: d.workDate,
      startTime: d.startTime,
      endTime: d.endTime,
      placeName: d.placeName,
      status: d.status,
      creatorNameTh: d.creatorNameTh,
      memberCount: (d.members || []).length,
      acceptedCount: (d.members || []).filter((m) => m.status === "accepted").length,
      myStatus: mine?.status || null,
      activeStep: active,
      activeStepStatus: active ? (d.approvals || []).find((a) => a.step === active)?.status : null,
      progress: progressOf(d),
      updatedAt: d.updatedAt,
    };
  });
}

/** Menu badge: { invites, approvals } waiting for the caller. Zeros for an unlinked account. */
export async function badgeCounts(session) {
  const emp = await getOwnEmployee(session, "_id");
  if (!emp) return { invites: 0, approvals: 0 };
  const [invites, approvals] = await Promise.all([
    OffsiteRequest.countDocuments(invitesMatch(emp._id)),
    OffsiteRequest.countDocuments(activeApprovalMatch(emp._id)),
  ]);
  return { invites, approvals };
}

/** Everyone who can be picked as a member: names, position, department. */
export function listPickableEmployees() {
  return Employee.find({})
    .select(`_id ${EMPLOYEE_NAME_FIELDS} empAutoId position department`)
    .sort({ firstNameTh: 1, firstName: 1 })
    .lean();
}

/* ── writes: creator & members ─────────────────────────────── */

export async function createRequest(session, input = {}) {
  const emp = await viewerEmployee(session);
  const fields = readInput(input, emp._id);
  const members = await buildMembers(input.members, emp);
  const doc = new OffsiteRequest({
    ...fields,
    ...(await creatorSnapshot(emp)),
    createdBy: emp._id,
    createdByUser: session.user.id,
    leader: input.leader,
    members,
    approvals: [
      { step: 1, role: "creator", approver: emp._id, approverName: nameOf(emp), status: "waiting" },
      { step: 2, role: "accounting_head", status: "waiting" },
      { step: 3, role: "hr_head", status: "waiting" },
    ],
    status: "draft",
    revision: 0,
  });
  addEvent(doc, session, "created", fields.jobName);
  await save(doc);
  return result(doc, emp, true);
}

export async function updateRequest(session, id, input = {}) {
  const { doc, emp, isCreator } = await loadOwn(session, id);
  requireCreator(isCreator);
  assertFrom(doc, "update");
  const fields = readInput(input, emp._id);
  doc.set(fields);
  doc.members = await buildMembers(input.members, emp, doc.members);
  doc.leader = input.leader;
  addEvent(doc, session, "updated");
  await save(doc);
  return result(doc, emp, isCreator);
}

/**
 * Send (or resend) invitations. The creator is auto-accepted with their saved
 * signature. On a resend, members who already accepted stay accepted — unless
 * the job details (name, date, time, place) changed since the last send, in
 * which case everyone is invited again. Declined members still listed and
 * members not yet sent an invitation are invited; pending ones stay pending.
 * After a return, the approval steps are reset (resetApprovals) and the
 * change summary recorded. The first send assigns the docNo.
 */
export async function sendInvitations(session, id, opts) {
  const deps = withDefaults(opts);
  const { doc, emp, isCreator } = await loadOwn(session, id);
  requireCreator(isCreator);
  assertFrom(doc, "send");

  const plain = doc.toObject();
  readInput(
    { ...plain, workDate: plain.workDate?.toISOString().slice(0, 10), members: plain.members.map((m) => ({ employee: str(m.employee), duty: m.duty })), leader: str(plain.leader) },
    emp._id
  );
  const creatorPng = await requireSignature(emp._id);

  const now = new Date();
  const revision = (doc.revision || 0) + 1;
  const key = detailsKey(doc);
  const detailsChanged = !!doc.sentDetailsKey && doc.sentDetailsKey !== key;
  let invited = 0;

  if (doc.status === "returned" && doc.returnSnapshot) {
    const changes = diffSnapshot(doc.returnSnapshot, doc);
    doc.changeSummary = { fromRevision: doc.returnSnapshot.revision, toRevision: revision, ...changes };
    resetApprovals(doc, changes.memberSetChanged, now);
    doc.returnSnapshot = null;
    addEvent(
      doc,
      session,
      "approvals_reset",
      changes.memberSetChanged ? "รายชื่อสมาชิกเปลี่ยน — ทุกขั้นต้องเซ็นใหม่" : "รายชื่อสมาชิกเหมือนเดิม — ขั้นที่อนุมัติแล้วยืนยันอีกครั้ง"
    );
  }

  for (const m of doc.members) {
    if (str(m.employee) === str(emp._id)) {
      if (m.status !== "accepted" || detailsChanged || !m.signature) {
        m.set({ status: "accepted", signature: creatorPng, respondedAt: now, declineReason: "", invitedInRevision: revision });
      }
    } else if (detailsChanged || m.status === "declined" || m.invitedInRevision == null) {
      m.set({ status: "invited", signature: "", respondedAt: null, declineReason: "", invitedInRevision: revision });
      invited += 1;
    }
  }

  doc.set({ ...(await creatorSnapshot(emp)), revision, sentDetailsKey: key });
  addEvent(
    doc,
    session,
    "invitations_sent",
    `ครั้งที่ ${revision}: เชิญ ${invited} คน${detailsChanged ? " (รายละเอียดงานเปลี่ยน — เชิญสมาชิกทุกคนใหม่)" : ""}`
  );
  if (allAccepted(doc)) await afterMembersAccepted(doc, session, deps);
  else doc.status = "inviting";

  // Last, so a refused send (409 above) consumes no number.
  if (!doc.docNo) doc.docNo = await nextDocNo();
  await save(doc);
  return result(doc, emp, isCreator);
}

/** A member answers their invitation: { action: "accept" | "decline", reason }. */
export async function respondToInvitation(session, id, { action, reason } = {}, opts) {
  const deps = withDefaults(opts);
  const { doc, emp, isCreator } = await loadOwn(session, id);
  const member = doc.members.find((m) => str(m.employee) === str(emp._id));
  if (!member) throw new OffsiteError("คุณไม่ได้อยู่ในรายชื่อสมาชิกของคำขอนี้", 403);
  if (isCreator) throw new OffsiteError("ผู้สร้างคำขอตอบรับโดยอัตโนมัติเมื่อส่งคำเชิญ", 409);
  assertFrom(doc, "respond");
  if (member.status !== "invited") {
    throw new OffsiteError(`คุณตอบคำเชิญนี้แล้ว (${MEMBER_STATUS_LABELS[member.status] || member.status})`, 409);
  }

  const now = new Date();
  if (action === "accept") {
    const png = await requireSignature(emp._id);
    member.set({ status: "accepted", signature: png, respondedAt: now, declineReason: "" });
    addEvent(doc, session, "member_accepted", member.nameSnapshot);
    if (allAccepted(doc)) await afterMembersAccepted(doc, session, deps);
  } else if (action === "decline") {
    const why = requireReason(reason, "ปฏิเสธ");
    member.set({ status: "declined", signature: "", respondedAt: now, declineReason: why });
    addEvent(doc, session, "member_declined", `${member.nameSnapshot}: ${why}`);
    markReturned(doc, session, { step: 0, byName: member.nameSnapshot, reason: why });
  } else {
    throw new OffsiteError("action ต้องเป็น accept หรือ decline", 400);
  }
  await save(doc);
  return result(doc, emp, isCreator);
}

/** Step 1: the creator signs (or re-signs); step 2 becomes active. */
export async function submitStep1(session, id, opts) {
  const deps = withDefaults(opts);
  const { doc, emp, isCreator } = await loadOwn(session, id);
  requireCreator(isCreator);
  assertFrom(doc, "submit");
  if (!allAccepted(doc)) throw new OffsiteError("สมาชิกยังตอบรับไม่ครบทุกคน", 409);
  const png = await requireSignature(emp._id);

  const now = new Date();
  stepOf(doc, 1).set({ approver: emp._id, approverName: nameOf(emp), status: "approved", signature: png, signedAt: now, confirmedAt: now, reason: "", selfApproval: false });
  doc.set(await creatorSnapshot(emp));
  addEvent(doc, session, "step1_signed", nameOf(emp));
  await activateNext(doc, session, deps);
  await save(doc);
  return result(doc, emp, isCreator);
}

export async function cancelRequest(session, id, { reason } = {}) {
  const { doc, emp, isCreator } = await loadOwn(session, id);
  requireCreator(isCreator);
  assertFrom(doc, "cancel");
  const why = requireReason(reason, "ยกเลิก");
  doc.status = "cancelled";
  addEvent(doc, session, "cancelled", why);
  await save(doc);
  return result(doc, emp, isCreator);
}

/* ── writes: approvers (steps 2–3) ─────────────────────────── */

/**
 * Load for an approver action on `step` (default: the active step). 409 when
 * the request is not in approval or `step` is not the active one; 403 when
 * the caller is not that step's approver.
 */
async function loadForDecision(session, id, step) {
  const loaded = await loadOwn(session, id);
  const { doc, emp } = loaded;
  if (doc.status === "approved") throw new OffsiteError("คำขอนี้อนุมัติครบแล้ว แก้ไขหรือลงนามเพิ่มไม่ได้", 409);
  assertFrom(doc, "decide");
  const active = activeStepOf(doc);
  const n = step == null || step === "" ? active : Number(step);
  if (!active || n !== active) throw new OffsiteError(`ขั้นที่ ${n} ไม่ใช่ขั้นที่รอดำเนินการอยู่ตอนนี้`, 409);
  const a = stepOf(doc, n);
  if (str(a.approver) !== str(emp._id)) throw new OffsiteError("คุณไม่ใช่ผู้อนุมัติของขั้นนี้", 403);
  return { ...loaded, n, a };
}

/** Validate and store the HR section (400 with field errors). */
function applyHrSummary(doc, input = {}) {
  const errors = validateHrSummary(input);
  if (Object.keys(errors).length) throw new OffsiteError("กรุณากรอกส่วนสำหรับฝ่ายบุคคลให้ครบถ้วน", 400, { errors });
  doc.hrSummary = {
    allowanceOption: input.allowanceOption,
    amountPerPerson: allowanceNeedsAmount(input.allowanceOption) ? Number(input.amountPerPerson) : null,
    note: clean(input.note),
  };
}

/** Step 3 approver saves the HR section without approving. */
export async function saveHrSummary(session, id, hrSummary) {
  const { doc, emp, isCreator, n, a } = await loadForDecision(session, id, 3);
  if (n !== 3 || a.status !== "pending") throw new OffsiteError("แก้ไขส่วนสำหรับฝ่ายบุคคลไม่ได้ในขั้นนี้", 409);
  applyHrSummary(doc, hrSummary);
  addEvent(doc, session, "hr_summary_saved", a.approverName);
  await save(doc);
  return result(doc, emp, isCreator);
}

/**
 * อนุมัติ: the active step's approver signs with their saved signature. Step 3
 * requires the HR section (sent as `hrSummary`, or saved before). The next
 * step activates; after step 3 the request is approved.
 */
export async function approveStep(session, id, { step, hrSummary } = {}, opts) {
  const deps = withDefaults(opts);
  const { doc, emp, isCreator, n, a } = await loadForDecision(session, id, step);
  if (a.status === "needs_reconfirm") throw new OffsiteError("ขั้นนี้ต้อง “ยืนยันอีกครั้ง” ไม่ต้องเซ็นใหม่", 409);
  if (n === 3) {
    if (hrSummary) applyHrSummary(doc, hrSummary);
    const errors = validateHrSummary(doc.toObject().hrSummary || {});
    if (Object.keys(errors).length) throw new OffsiteError("กรุณากรอกส่วนสำหรับฝ่ายบุคคลก่อนอนุมัติ", 400, { errors });
  }
  const png = await requireSignature(emp._id);
  const now = new Date();
  const self = inRequest(doc, emp._id);
  a.set({ status: "approved", signature: png, signedAt: now, confirmedAt: now, reason: "", selfApproval: self });
  addPastApprover(doc, emp._id);
  addEvent(doc, session, `step${n}_approved`, `${a.approverName}${self ? ` (${SELF_APPROVAL_LABEL})` : ""}`);
  await activateNext(doc, session, deps); // 409 here → nothing saved
  await save(doc);
  return result(doc, emp, isCreator);
}

/** ยืนยันอีกครั้ง: a needs_reconfirm step's approver confirms; the earlier signature is kept. */
export async function reconfirmStep(session, id, { step } = {}, opts) {
  const deps = withDefaults(opts);
  const { doc, emp, isCreator, n, a } = await loadForDecision(session, id, step);
  if (a.status !== "needs_reconfirm") throw new OffsiteError("ขั้นนี้ต้องลงนามใหม่ ไม่ใช่ยืนยันอีกครั้ง", 409);
  a.set({ status: "approved", confirmedAt: new Date() });
  addPastApprover(doc, emp._id);
  addEvent(doc, session, `step${n}_reconfirmed`, a.approverName);
  await activateNext(doc, session, deps);
  await save(doc);
  return result(doc, emp, isCreator);
}

/** ไม่อนุมัติ: required reason; the request goes back to the creator. */
export async function rejectStep(session, id, { step, reason } = {}) {
  const { doc, emp, isCreator, n, a } = await loadForDecision(session, id, step);
  const why = requireReason(reason, "ไม่อนุมัติ");
  a.set({ status: "rejected", signature: "", signedAt: null, confirmedAt: null, reason: why });
  addPastApprover(doc, emp._id);
  addEvent(doc, session, `step${n}_rejected`, `${a.approverName}: ${why}`);
  markReturned(doc, session, { step: n, byName: a.approverName, reason: why });
  await save(doc);
  return result(doc, emp, isCreator);
}

/** OffsiteError → JSON response body + status; anything else is a 500. */
export function offsiteErrorResponse(e, tag) {
  if (e instanceof OffsiteError) {
    return { body: { error: e.message, ...e.extra }, status: e.status };
  }
  console.error(`[offsite]${tag ? `[${tag}]` : ""}`, e);
  return { body: { error: "เกิดข้อผิดพลาดในระบบ" }, status: 500 };
}
