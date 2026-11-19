/**
 * Leave settings rules. Pure — browser-safe; the settings page and the
 * leave-settings APIs share them.
 */
import { parseDateKey } from "./leave/countLeave.js";

export const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TZ = "Asia/Bangkok";

export const FORM_CATEGORIES = ["sick", "personal", "annual", "other"];
export const FORM_CATEGORY_LABELS = { sick: "ลาป่วย", personal: "ลากิจ", annual: "ลาพักร้อน", other: "อื่นๆ" };
export const LEAVE_UNITS = ["day", "half", "hour"];
export const UNIT_LABELS = { day: "เต็มวัน", half: "ครึ่งวัน", hour: "รายชั่วโมง" };

/** Defaults of the settings singleton (models/LeaveSettings.js). */
export const SETTINGS_DEFAULTS = {
  fiscalYearStartMonth: 1,
  hoursPerDay: 8,
  workdayStart: "09:00",
  workdayEnd: "18:00",
  halfDayMorning: "09:00–12:00",
  halfDayAfternoon: "13:00–18:00",
};

/** The three seeded system types (isSystem: true). */
export const SYSTEM_LEAVE_TYPES = [
  { systemKey: "sick", nameTh: "ลาป่วย", formCategory: "sick", units: ["day", "half", "hour"], defaultQuotaDays: 30, requiresAttachmentFromDays: 3, sortOrder: 10 },
  { systemKey: "personal", nameTh: "ลากิจ", formCategory: "personal", units: ["day", "half", "hour"], defaultQuotaDays: 3, requiresAttachmentFromDays: null, sortOrder: 20 },
  { systemKey: "annual", nameTh: "ลาพักร้อน", formCategory: "annual", units: ["day", "half", "hour"], defaultQuotaDays: 10, requiresAttachmentFromDays: null, sortOrder: 30 },
];

/* ── fiscal year ─────────────────────────────────────────────── */

function bangkokYm(date) {
  const [y, m] = new Date(date).toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
  return { y, m };
}

/**
 * The fiscal year (Gregorian year in which it starts) containing `date`, in
 * Bangkok time. A leave belongs to the fiscal year containing its start date.
 */
export function fiscalYearOf(date, startMonth = 1) {
  const { y, m } = bangkokYm(date);
  return m >= startMonth ? y : y - 1;
}

/** Label of a fiscal year: the Buddhist year in which it starts ("2569"). */
export const fiscalYearLabel = (fy) => String(fy + 543);

/** First and last calendar day of fiscal year `fy`: { start: {y,m,d}, end: {y,m,d} }. */
export function fiscalYearRange(fy, startMonth = 1) {
  const start = { y: fy, m: startMonth, d: 1 };
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endYear = startMonth === 1 ? fy : fy + 1;
  const lastDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  return { start, end: { y: endYear, m: endMonth, d: lastDay } };
}

const ymdTh = ({ y, m, d }) => `${d} ${MONTHS_SHORT[m - 1]} ${y + 543}`;

/** "1 ม.ค. 2569 – 31 ธ.ค. 2569" */
export function fiscalYearRangeTh(fy, startMonth = 1) {
  const { start, end } = fiscalYearRange(fy, startMonth);
  return `${ymdTh(start)} – ${ymdTh(end)}`;
}

/* ── times ───────────────────────────────────────────────────── */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isTime = (s) => typeof s === "string" && TIME_RE.test(s);
const minutes = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/** "HH:mm–HH:mm" (en dash; a hyphen is accepted) → [from, to] or null; from < to. */
export function parseRange(s) {
  if (typeof s !== "string") return null;
  const parts = s.split(/\s*[–-]\s*/);
  if (parts.length !== 2 || !isTime(parts[0]) || !isTime(parts[1])) return null;
  return minutes(parts[0]) < minutes(parts[1]) ? parts : null;
}
export const formatRange = ([a, b]) => `${a}–${b}`;

/**
 * Validates the ทั่วไป tab. Returns { value } (cleaned) or { error, field }.
 * hrSigners is checked against the database by the API.
 */
export function validateGeneralSettings(input) {
  const v = input || {};
  const month = Number(v.fiscalYearStartMonth);
  if (!Number.isInteger(month) || month < 1 || month > 12) return { error: "เดือนเริ่มปีงบประมาณไม่ถูกต้อง", field: "fiscalYearStartMonth" };
  const hours = Number(v.hoursPerDay);
  if (!Number.isFinite(hours) || hours < 1 || hours > 24 || !Number.isInteger(hours * 2)) return { error: "จำนวนชั่วโมงต่อวันต้องอยู่ระหว่าง 1–24", field: "hoursPerDay" };
  if (!isTime(v.workdayStart)) return { error: "เวลาเริ่มงานไม่ถูกต้อง (HH:mm)", field: "workdayStart" };
  if (!isTime(v.workdayEnd)) return { error: "เวลาเลิกงานไม่ถูกต้อง (HH:mm)", field: "workdayEnd" };
  if (minutes(v.workdayStart) >= minutes(v.workdayEnd)) return { error: "เวลาเลิกงานต้องหลังเวลาเริ่มงาน", field: "workdayEnd" };
  const morning = parseRange(v.halfDayMorning);
  if (!morning) return { error: "ช่วงครึ่งวันเช้าไม่ถูกต้อง (HH:mm–HH:mm)", field: "halfDayMorning" };
  const afternoon = parseRange(v.halfDayAfternoon);
  if (!afternoon) return { error: "ช่วงครึ่งวันบ่ายไม่ถูกต้อง (HH:mm–HH:mm)", field: "halfDayAfternoon" };
  if (minutes(morning[1]) > minutes(afternoon[0])) return { error: "ครึ่งวันบ่ายต้องเริ่มหลังครึ่งวันเช้าสิ้นสุด", field: "halfDayAfternoon" };
  return {
    value: {
      fiscalYearStartMonth: month,
      hoursPerDay: hours,
      workdayStart: v.workdayStart,
      workdayEnd: v.workdayEnd,
      halfDayMorning: formatRange(morning),
      halfDayAfternoon: formatRange(afternoon),
    },
  };
}

/* ── leave types ─────────────────────────────────────────────── */

export const leaveTypeNameKey = (name) => String(name || "").trim().toLowerCase();

/** A whole or half number ≥ 0, or null. `undefined`/"" → null. Returns { value } or { error }. */
function halfStepOrNull(v, label) {
  if (v === null || v === undefined || v === "") return { value: null };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n * 2)) return { error: `${label}ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป (ทีละครึ่งวัน)` };
  return { value: n };
}

/** Validates a leave type form. Returns { value } or { error, field }. */
export function validateLeaveType(input) {
  const v = input || {};
  const nameTh = String(v.nameTh || "").trim();
  if (!nameTh) return { error: "กรุณาระบุชื่อประเภทการลา", field: "nameTh" };
  if (nameTh.length > 60) return { error: "ชื่อประเภทการลายาวเกิน 60 ตัวอักษร", field: "nameTh" };
  if (!FORM_CATEGORIES.includes(v.formCategory)) return { error: "กรุณาเลือกหมวดในแบบฟอร์ม", field: "formCategory" };
  const units = Array.isArray(v.units) ? LEAVE_UNITS.filter((u) => v.units.includes(u)) : [];
  if (!units.length || units.length !== new Set(v.units).size) return { error: "เลือกหน่วยที่ลาได้อย่างน้อย 1 หน่วย", field: "units" };
  const quota = halfStepOrNull(v.defaultQuotaDays, "โควตาเริ่มต้น");
  if (quota.error) return { error: quota.error, field: "defaultQuotaDays" };
  const attach = halfStepOrNull(v.requiresAttachmentFromDays, "จำนวนวันที่ต้องแนบเอกสาร");
  if (attach.error) return { error: attach.error, field: "requiresAttachmentFromDays" };
  return { value: { nameTh, formCategory: v.formCategory, units, defaultQuotaDays: quota.value, requiresAttachmentFromDays: attach.value, isActive: v.isActive !== false } };
}

/** A quota cell: whole or half days ≥ 0 (max 366), or null = no limit. Returns { value } or { error }. */
export function validateQuota(v) {
  if (v === null) return { value: null };
  const n = Number(v);
  if (v === "" || v === undefined || !Number.isFinite(n) || n < 0 || n > 366 || !Number.isInteger(n * 2)) return { error: "โควตาต้องเป็น 0–366 วัน ทีละครึ่งวัน หรือไม่จำกัด" };
  return { value: n };
}

/* ── holidays (ตั้งค่าการลา › วันหยุด) ─────────────────────────── */

export const HOLIDAY_KINDS = ["public", "company"];
export const HOLIDAY_KIND_LABELS = { public: "วันหยุดนักขัตฤกษ์", company: "วันหยุดบริษัท" };
/** Weekday toggles, Monday first: [weekday (0 = Sunday), label]. */
export const WEEKDAY_TOGGLES = [[1, "จ."], [2, "อ."], [3, "พ."], [4, "พฤ."], [5, "ศ."], [6, "ส."], [0, "อา."]];

/** Validates the add / edit holiday form. Returns { value: { date ("YYYY-MM-DD"), name, kind } } or { error, field }. */
export function validateHoliday(input) {
  const v = input || {};
  const date = parseDateKey(v.date);
  if (!date) return { error: "กรุณาเลือกวันที่", field: "date" };
  const name = String(v.name || "").trim();
  if (!name) return { error: "กรุณาระบุชื่อวันหยุด", field: "name" };
  if (name.length > 100) return { error: "ชื่อวันหยุดยาวเกิน 100 ตัวอักษร", field: "name" };
  if (!HOLIDAY_KINDS.includes(v.kind)) return { error: "กรุณาเลือกประเภทวันหยุด", field: "kind" };
  return { value: { date, name, kind: v.kind } };
}

/** Weekly days off: distinct integers 0–6, at least one working day left. Returns { value } (sorted) or { error }. */
export function validateWeeklyDaysOff(v) {
  if (!Array.isArray(v) || v.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || new Set(v).size !== v.length) {
    return { error: "วันหยุดประจำสัปดาห์ไม่ถูกต้อง" };
  }
  if (v.length > 6) return { error: "ต้องมีวันทำงานอย่างน้อย 1 วันต่อสัปดาห์" };
  return { value: [...v].sort((a, b) => a - b) };
}

/* ── per-employee approvers ──────────────────────────────────── */

const idOf = (v) => (v ? String(v) : null);

/**
 * Normalise an approver pair: only approver 2 set → it becomes approver 1;
 * the same person twice → approver 1 only. Returns { approver1Id, approver2Id }.
 */
export function normalizeApprovers(a1, a2) {
  let one = idOf(a1);
  let two = idOf(a2);
  if (!one && two) [one, two] = [two, null];
  if (one && two && one === two) two = null;
  return { approver1Id: one, approver2Id: two };
}

/** "auto" (none), "single" (one person), "either" (two different people). */
export function approverMode(a1, a2) {
  const { approver1Id, approver2Id } = normalizeApprovers(a1, a2);
  if (!approver1Id) return "auto";
  return approver2Id ? "either" : "single";
}

export const APPROVER_MODE_LABELS = { auto: "อนุมัติอัตโนมัติ", single: "อนุมัติคนเดียว", either: "คนใดคนหนึ่งอนุมัติ" };
