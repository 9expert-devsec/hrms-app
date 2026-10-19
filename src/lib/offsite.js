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
  MEMBER_STATUS_LABELS,
  STATUS_LABELS,
  detailsKey,
  parseWorkDate,
  progressOf,
  validateOffsiteInput,
} from "@/lib/offsiteRules";

/**
 * Off-site work requests — the ONE write path. Every action checks who the
 * caller is, checks the status machine (an illegal transition is a 409) and
 * appends to `events`. Callers must have called dbConnect() first.
 *
 *   draft ──send──▶ inviting ──all accepted──▶ members_ready ──step 1──▶ in_approval
 *     ▲               │ any decline                                     (steps 2–3: OS-2)
 *     └─(edit)── returned ◀┘
 *   anything before approved ──cancel──▶ cancelled
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
  cancel: ["draft", "inviting", "members_ready", "in_approval", "returned"],
};

const SIGNATURE_MAX_BYTES = 60 * 1024;
const PNG_DATA_URL_RE = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;
const VIEWER_FIELDS = `_id ${EMPLOYEE_NAME_FIELDS} position department departmentId userId`;
const LIST_PROJECTION = "-members.signature -approvals.signature -events";

const str = (v) => (v == null ? "" : String(v));
const clean = (v) => (typeof v === "string" ? v.trim() : "");
const nameOf = (emp) => employeeFullNameTh(emp) || employeeDisplayName(emp);

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

function canRead(doc, empId, user) {
  if (user?.isSuperadmin === true) return true;
  const me = str(empId);
  if (!me) return false;
  if (str(doc.createdBy) === me) return true;
  if ((doc.members || []).some((m) => str(m.employee) === me)) return true;
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

/* ── serialization ─────────────────────────────────────────── */

function serialize(doc) {
  const r = doc.toObject ? doc.toObject() : doc;
  return {
    ...r,
    _id: str(r._id),
    createdBy: str(r.createdBy),
    createdByUser: str(r.createdByUser),
    leader: r.leader ? str(r.leader) : null,
    members: (r.members || []).map((m) => ({ ...m, employee: str(m.employee) })),
    approvals: (r.approvals || []).map((a) => ({ ...a, approver: a.approver ? str(a.approver) : null })),
    events: (r.events || []).map((e) => ({ ...e, by: e.by ? str(e.by) : null })),
    progress: progressOf(r),
  };
}

function viewerFlags(doc, empId, isCreator) {
  const me = str(empId);
  const mine = doc.members.find((m) => str(m.employee) === me) || null;
  return {
    employeeId: me,
    isCreator,
    memberStatus: mine?.status || null,
    canEdit: isCreator && ALLOWED_FROM.update.includes(doc.status),
    canSend: isCreator && ALLOWED_FROM.send.includes(doc.status),
    canRespond: !isCreator && doc.status === "inviting" && mine?.status === "invited",
    canSubmit: isCreator && doc.status === "members_ready",
    canCancel: isCreator && ALLOWED_FROM.cancel.includes(doc.status),
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

/**
 * The caller's lists. `box`: "mine" (created by me), "invites" (waiting for
 * my answer), "member" (requests I am on, created by someone else).
 */
export async function listRequests(session, box = "mine") {
  const emp = await viewerEmployee(session);
  const me = emp._id;
  const query =
    box === "invites"
      ? { status: "inviting", members: { $elemMatch: { employee: me, status: "invited" } }, createdBy: { $ne: me } }
      : box === "member"
        ? { "members.employee": me, createdBy: { $ne: me } }
        : { createdBy: me };
  const docs = await OffsiteRequest.find(query).select(LIST_PROJECTION).sort({ workDate: -1, createdAt: -1 }).limit(200).lean();
  return docs.map((d) => {
    const mine = (d.members || []).find((m) => str(m.employee) === str(me));
    return {
      _id: str(d._id),
      docNo: d.docNo,
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
      progress: progressOf(d),
      updatedAt: d.updatedAt,
    };
  });
}

/** Invitations waiting for the caller's answer (menu badge). 0 for an unlinked account. */
export async function inviteCount(session) {
  const emp = await getOwnEmployee(session, "_id");
  if (!emp) return 0;
  return OffsiteRequest.countDocuments({
    status: "inviting",
    createdBy: { $ne: emp._id },
    members: { $elemMatch: { employee: emp._id, status: "invited" } },
  });
}

/** Everyone who can be picked as a member: names, position, department. */
export function listPickableEmployees() {
  return Employee.find({})
    .select(`_id ${EMPLOYEE_NAME_FIELDS} empAutoId position department`)
    .sort({ firstNameTh: 1, firstName: 1 })
    .lean();
}

/* ── writes ────────────────────────────────────────────────── */

export async function createRequest(session, input = {}) {
  const emp = await viewerEmployee(session);
  const fields = readInput(input, emp._id);
  const members = await buildMembers(input.members, emp);
  const doc = new OffsiteRequest({
    ...fields,
    ...(await creatorSnapshot(emp)),
    docNo: await nextDocNo(),
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
 */
export async function sendInvitations(session, id) {
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
  doc.status = allAccepted(doc) ? "members_ready" : "inviting";
  addEvent(
    doc,
    session,
    "invitations_sent",
    `ครั้งที่ ${revision}: เชิญ ${invited} คน${detailsChanged ? " (รายละเอียดงานเปลี่ยน — เชิญสมาชิกทุกคนใหม่)" : ""}`
  );
  if (doc.status === "members_ready") addEvent(doc, session, "members_ready");
  await save(doc);
  return result(doc, emp, isCreator);
}

/** A member answers their invitation: { action: "accept" | "decline", reason }. */
export async function respondToInvitation(session, id, { action, reason } = {}) {
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
    if (allAccepted(doc)) {
      doc.status = "members_ready";
      addEvent(doc, session, "members_ready");
    }
  } else if (action === "decline") {
    const why = clean(reason);
    if (!why) throw new OffsiteError("กรุณาระบุเหตุผลที่ปฏิเสธ", 400, { errors: { reason: "กรุณาระบุเหตุผลที่ปฏิเสธ" } });
    if (why.length > 500) throw new OffsiteError("เหตุผลยาวเกิน 500 ตัวอักษร", 400, { errors: { reason: "เหตุผลยาวเกิน 500 ตัวอักษร" } });
    member.set({ status: "declined", signature: "", respondedAt: now, declineReason: why });
    doc.status = "returned";
    addEvent(doc, session, "member_declined", `${member.nameSnapshot}: ${why}`);
    addEvent(doc, session, "returned");
  } else {
    throw new OffsiteError("action ต้องเป็น accept หรือ decline", 400);
  }
  await save(doc);
  return result(doc, emp, isCreator);
}

/**
 * The accounting department's head, who signs step 2. No guessing: a missing
 * department, head or head account is a 409 naming the problem.
 */
async function resolveAccountingHead() {
  const dept = await Department.findOne({ code: ACCOUNTING_DEPT_CODE })
    .select("_id code name headOfDepartment")
    .populate("headOfDepartment", HEAD_FIELDS)
    .lean();
  if (!dept) throw new OffsiteError(`ไม่พบแผนกบัญชี (รหัส ${ACCOUNTING_DEPT_CODE}) ในระบบ — กรุณาติดต่อผู้ดูแลระบบ`, 409);
  const head = dept.headOfDepartment;
  if (!head) throw new OffsiteError(`แผนก${dept.name}ยังไม่ได้กำหนดหัวหน้าแผนก จึงส่งแบบฟอร์มไม่ได้ — กรุณาแจ้ง HR ให้กำหนดหัวหน้าแผนกก่อน`, 409);
  if (!head.userId) {
    throw new OffsiteError(`หัวหน้าแผนก${dept.name} (${nameOf(head)}) ยังไม่มีบัญชีผู้ใช้ในระบบ จึงลงนามไม่ได้ — กรุณาแจ้ง HR`, 409);
  }
  return head;
}

/** Step 1: the creator signs; step 2 becomes pending with the accounting head. */
export async function submitStep1(session, id) {
  const { doc, emp, isCreator } = await loadOwn(session, id);
  requireCreator(isCreator);
  assertFrom(doc, "submit");
  if (!allAccepted(doc)) throw new OffsiteError("สมาชิกยังตอบรับไม่ครบทุกคน", 409);
  const png = await requireSignature(emp._id);
  const head = await resolveAccountingHead();

  const now = new Date();
  const step = (n) => doc.approvals.find((a) => a.step === n);
  step(1).set({ approver: emp._id, approverName: nameOf(emp), status: "approved", signature: png, signedAt: now, confirmedAt: now, reason: "" });
  step(2).set({ approver: head._id, approverName: nameOf(head), status: "pending", signature: "", signedAt: null, confirmedAt: null, reason: "" });
  doc.set(await creatorSnapshot(emp));
  doc.status = "in_approval";
  addEvent(doc, session, "step1_signed", nameOf(emp));
  addEvent(doc, session, "step2_pending", nameOf(head));
  await save(doc);
  return result(doc, emp, isCreator);
}

export async function cancelRequest(session, id, { reason } = {}) {
  const { doc, emp, isCreator } = await loadOwn(session, id);
  requireCreator(isCreator);
  assertFrom(doc, "cancel");
  const why = clean(reason);
  if (!why) throw new OffsiteError("กรุณาระบุเหตุผลที่ยกเลิก", 400, { errors: { reason: "กรุณาระบุเหตุผลที่ยกเลิก" } });
  if (why.length > 500) throw new OffsiteError("เหตุผลยาวเกิน 500 ตัวอักษร", 400, { errors: { reason: "เหตุผลยาวเกิน 500 ตัวอักษร" } });
  doc.status = "cancelled";
  addEvent(doc, session, "cancelled", why);
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
