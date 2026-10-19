/**
 * Off-site work (ทำงานนอกสถานที่) — pure rules shared by the request form
 * (browser) and lib/offsite.js (server). No server imports.
 */

export const OFFSITE_STATUSES = ["draft", "inviting", "members_ready", "in_approval", "returned", "approved", "cancelled"];
export const MEMBER_STATUSES = ["invited", "accepted", "declined"];
export const APPROVAL_STATUSES = ["waiting", "pending", "approved", "rejected", "needs_reconfirm", "needs_resign"];
export const APPROVAL_ROLES = ["creator", "accounting_head", "hr_head"];
export const TRAVEL_MODES = ["self_from_company", "company_van", "from_lodging"];
export const ALLOWANCE_OPTIONS = ["per_person", "per_person_plus_travel", "travel_actual", "no_allowance"];

export const MAX_MEMBERS = 10; // the paper form has 10 lines
export const MIN_MEMBERS = 1;

/** Department codes whose heads sign steps 2 and 3. */
export const ACCOUNTING_DEPT_CODE = "AC";
export const HR_DEPT_CODE = "HR";

export const STATUS_LABELS = {
  draft: "ฉบับร่าง",
  inviting: "รอสมาชิกตอบรับ",
  members_ready: "สมาชิกตอบรับครบ",
  in_approval: "อยู่ระหว่างอนุมัติ",
  returned: "ส่งกลับให้แก้ไข",
  approved: "อนุมัติแล้ว",
  cancelled: "ยกเลิกแล้ว",
};

export const MEMBER_STATUS_LABELS = { invited: "รอตอบรับ", accepted: "ยอมรับแล้ว", declined: "ปฏิเสธ" };

export const TRAVEL_MODE_LABELS = {
  self_from_company: "เดินทางเองจากบริษัท",
  company_van: "รถตู้บริษัท",
  from_lodging: "เดินทางจากที่พัก",
};

export const APPROVAL_ROLE_LABELS = {
  creator: "ผู้สร้างคำขอ",
  accounting_head: "หัวหน้าฝ่ายบัญชี",
  hr_head: "หัวหน้าฝ่ายบุคคล",
};

/** Form field labels (ErrorSummary `labels`). */
export const OFFSITE_FIELD_LABELS = {
  jobName: "ชื่องาน",
  workDate: "วันที่ปฏิบัติงาน",
  startTime: "เวลาเริ่ม",
  endTime: "เวลาสิ้นสุด",
  description: "รายละเอียดงาน",
  placeName: "สถานที่",
  address: "ที่อยู่สถานที่",
  travelMode: "การเดินทาง",
  members: "สมาชิก",
  leader: "หัวหน้าทีม",
  note: "หมายเหตุ",
};

export const REQUIRED_FIELDS = ["jobName", "workDate", "startTime", "endTime", "description", "placeName", "address", "travelMode", "members", "leader"];

const LIMITS = { jobName: 200, description: 2000, placeName: 200, address: 500, note: 1000, duty: 200 };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const clean = (v) => (typeof v === "string" ? v.trim() : "");

/** "YYYY-MM-DD" → Date at UTC midnight, or null. */
export function parseWorkDate(value) {
  const s = clean(value);
  if (!DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

/** Date (UTC midnight) → "YYYY-MM-DD", or "". */
export function workDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Work date in Thai ("20 ต.ค. 2569"). */
export function formatWorkDateTh(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

export const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** Work date → { day, month (Thai name), yearBE } for "ในวันที่ … เดือน … พ.ศ. …". */
export function workDateParts(value) {
  const d = value ? new Date(value) : null;
  if (!d || isNaN(d.getTime())) return { day: "", month: "", yearBE: "" };
  return { day: d.getUTCDate(), month: THAI_MONTHS[d.getUTCMonth()], yearBE: d.getUTCFullYear() + 543 };
}

/** Timestamp → "19 ตุลาคม 2569" (Asia/Bangkok, Buddhist year). */
export function formatDateLongTh(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const [y, m, day] = d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).split("-").map(Number);
  return `${day} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

/** Timestamp in Thai with time (Asia/Bangkok). */
export function formatDateTimeTh(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const hasDuplicates = (ids) => new Set(ids).size !== ids.length;

/**
 * Validate the form input. `input.members` = [{ employee, duty }]; it must
 * include the creator (`creatorId`), who is always a member.
 * Returns { errors: { field: message }, memberErrors: { index: message } }.
 */
export function validateOffsiteInput(input = {}, { creatorId = null } = {}) {
  const errors = {};
  const memberErrors = {};
  for (const key of ["jobName", "description", "placeName", "address"]) {
    if (!clean(input[key])) errors[key] = `กรุณากรอก${OFFSITE_FIELD_LABELS[key]}`;
  }
  for (const [key, max] of Object.entries(LIMITS)) {
    if (key !== "duty" && clean(input[key]).length > max) errors[key] = `${OFFSITE_FIELD_LABELS[key]}ยาวเกิน ${max} ตัวอักษร`;
  }
  if (!clean(input.workDate)) errors.workDate = "กรุณาเลือกวันที่ปฏิบัติงาน";
  else if (!parseWorkDate(input.workDate)) errors.workDate = "วันที่ไม่ถูกต้อง";

  const start = clean(input.startTime);
  const end = clean(input.endTime);
  if (!start) errors.startTime = "กรุณากรอกเวลาเริ่ม";
  else if (!TIME_RE.test(start)) errors.startTime = "เวลาต้องเป็นรูปแบบ HH:mm";
  if (!end) errors.endTime = "กรุณากรอกเวลาสิ้นสุด";
  else if (!TIME_RE.test(end)) errors.endTime = "เวลาต้องเป็นรูปแบบ HH:mm";
  else if (TIME_RE.test(start) && end <= start) errors.endTime = "เวลาสิ้นสุดต้องหลังเวลาเริ่ม";

  if (!TRAVEL_MODES.includes(input.travelMode)) errors.travelMode = "กรุณาเลือกการเดินทาง";

  const members = Array.isArray(input.members) ? input.members : [];
  const ids = members.map((m) => String(m?.employee || "")).filter(Boolean);
  const unique = new Set(ids);
  if (hasDuplicates(ids)) errors.members = "มีสมาชิกซ้ำกัน";
  else if (creatorId && !unique.has(String(creatorId))) errors.members = "ผู้สร้างคำขอต้องอยู่ในรายชื่อสมาชิก";
  else if (unique.size < MIN_MEMBERS) errors.members = "กรุณาเลือกสมาชิกอย่างน้อย 1 คน";
  else if (unique.size > MAX_MEMBERS) errors.members = `สมาชิกได้ไม่เกิน ${MAX_MEMBERS} คน`;
  members.forEach((m, i) => {
    const duty = clean(m?.duty);
    if (!m?.employee) memberErrors[i] = "กรุณาเลือกพนักงาน";
    else if (!duty) memberErrors[i] = "กรุณากรอกหน้าที่";
    else if (duty.length > LIMITS.duty) memberErrors[i] = `หน้าที่ยาวเกิน ${LIMITS.duty} ตัวอักษร`;
  });
  if (Object.keys(memberErrors).length && !errors.members) errors.members = "กรุณากรอกหน้าที่ของสมาชิกทุกคน";

  const leader = String(input.leader || "");
  if (!leader) errors.leader = "กรุณาเลือกหัวหน้าทีม";
  else if (!unique.has(leader)) errors.leader = "หัวหน้าทีมต้องเป็นหนึ่งในสมาชิก";

  return { errors, memberErrors };
}

/** The job details members agree to; a change re-invites everyone on resend. */
export function detailsKey(r) {
  return JSON.stringify([
    clean(r?.jobName),
    workDateInput(r?.workDate),
    clean(r?.startTime),
    clean(r?.endTime),
    clean(r?.placeName),
    clean(r?.address),
  ]);
}

export const PROGRESS_STEPS = ["สมาชิกตอบรับ", "ผู้สร้างเซ็น", "บัญชี", "HR", "อนุมัติแล้ว"];

/** Approval statuses in which a step is the one being acted on. */
export const ACTIVE_APPROVAL_STATUSES = ["pending", "needs_reconfirm"];

/** The step (2 or 3) waiting for its approver while in_approval, or null. */
export function activeStepOf(r) {
  if (r?.status !== "in_approval") return null;
  const a = (r.approvals || []).find((x) => x.step >= 2 && ACTIVE_APPROVAL_STATUSES.includes(x.status));
  return a ? a.step : null;
}

/**
 * Progress-bar position (index into PROGRESS_STEPS) for a request:
 * draft / inviting → 0, members_ready → 1, in_approval → the active step
 * (2 or 3), approved → 4, returned → the step that rejected (0 for a member
 * decline). A cancelled request reports where it stopped, with `cancelled`.
 */
export function progressOf(r) {
  const approvals = Array.isArray(r?.approvals) ? r.approvals : [];
  const byStep = (n) => approvals.find((a) => a.step === n);
  const firstOpen = () => {
    if (byStep(1)?.status !== "approved") return 0;
    if (byStep(2)?.status !== "approved") return 2;
    if (byStep(3)?.status !== "approved") return 3;
    return 4;
  };
  const position = (() => {
    switch (r?.status) {
      case "approved":
        return 4;
      case "members_ready":
        return 1;
      case "draft":
      case "inviting":
        return 0;
      case "returned": {
        const rejected = approvals.find((a) => a.status === "rejected");
        return rejected ? rejected.step : 0;
      }
      default:
        return firstOpen();
    }
  })();
  return { position, cancelled: r?.status === "cancelled", done: r?.status === "approved" };
}

/** What a step asks of its approver after a return. */
export const APPROVAL_ASK_LABELS = {
  needs_resign: "เซ็นใหม่",
  needs_reconfirm: "ตรวจสอบและยืนยันอีกครั้ง",
};

export const SELF_APPROVAL_LABEL = "อนุมัติคำขอที่ตนเองอยู่ในกลุ่ม";

/* ── HR section "สำหรับฝ่ายบุคคล" (step 3) ──────────────────────── */

export const DEFAULT_ALLOWANCE_PER_PERSON = 500; // company policy

/** Display order = ALLOWANCE_OPTIONS. `…` is where the amount goes. */
export const ALLOWANCE_OPTION_LABELS = {
  per_person: "เบี้ยเลี้ยง … บาท/ท่าน",
  per_person_plus_travel: "เบี้ยเลี้ยง … บาท/ท่าน และค่าเดินทางตามจริง (กรณีไปทำงานมากกว่า 1 ที่)",
  travel_actual: "ค่าเดินทางตามจริง",
  no_allowance: "ไม่เบิกเบี้ยเลี้ยง",
};

/** Options that pay a per-person allowance (amount shown and required). */
export function allowanceNeedsAmount(option) {
  return option === "per_person" || option === "per_person_plus_travel";
}

/** Validate the HR section. Returns { field: message } (empty = valid). */
export function validateHrSummary(input = {}) {
  const errors = {};
  if (!ALLOWANCE_OPTIONS.includes(input.allowanceOption)) {
    errors.allowanceOption = "กรุณาเลือกรายการเบี้ยเลี้ยง";
    return errors;
  }
  if (allowanceNeedsAmount(input.allowanceOption)) {
    const n = Number(input.amountPerPerson);
    if (input.amountPerPerson === "" || input.amountPerPerson == null) errors.amountPerPerson = "กรุณากรอกจำนวนเงินต่อท่าน";
    else if (!Number.isInteger(n) || n <= 0) errors.amountPerPerson = "จำนวนเงินต้องเป็นจำนวนเต็มบวก";
    else if (n > 100000) errors.amountPerPerson = "จำนวนเงินสูงเกินไป";
  }
  if (clean(input.note).length > 1000) errors.note = "หมายเหตุยาวเกิน 1000 ตัวอักษร";
  return errors;
}

/** "รวม N ท่าน × X บาท = Y บาท" parts, or null when the option pays no allowance. */
export function allowanceTotal(hrSummary, memberCount) {
  if (!allowanceNeedsAmount(hrSummary?.allowanceOption)) return null;
  const amount = Number(hrSummary.amountPerPerson);
  if (!Number.isInteger(amount) || amount <= 0) return null;
  return { count: memberCount, amount, total: memberCount * amount };
}

export function formatBaht(n) {
  return Number(n).toLocaleString("th-TH");
}

/** Labels for the "สิ่งที่เปลี่ยนจากครั้งก่อน" list. */
export const CHANGE_FIELD_LABELS = {
  ...OFFSITE_FIELD_LABELS,
  duties: "หน้าที่ของสมาชิก",
};
