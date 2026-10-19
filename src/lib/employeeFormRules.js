/**
 * Employee create / edit form rules — which fields are required and the Thai
 * messages shown under them. Pure — safe in the browser. Used by
 * employee/create/page.jsx and employee/edit/EmployeeEditForm.jsx.
 *
 * Required fields follow the server: POST /api/employees (all of these on
 * create, the account email when "สร้างบัญชีให้พนักงาน" is ticked) and the
 * Employee schema (on edit). The Thai name is required on create; on edit
 * only once a value is stored, because it may not be cleared (round 12).
 *
 * Format rules (10-digit phone, email shape) are stricter than the server,
 * which only checks presence. On edit they apply only to a value that was
 * changed, so an existing record with an older format (e.g. a 9-digit
 * landline) can still be saved when another field is edited.
 */
import { TITLES_TH } from "@/lib/employeeName";

export const PHONE_RE = /^\d{10}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field key → label, in form order (the summary lists them in this order). */
export const FIELD_LABELS = {
  titleTh: "คำนำหน้าชื่อ",
  firstNameTh: "ชื่อ (ไทย)",
  lastNameTh: "นามสกุล (ไทย)",
  firstName: "ชื่อ (อังกฤษ)",
  lastName: "นามสกุล (อังกฤษ)",
  departmentId: "แผนก",
  positionId: "ตำแหน่ง",
  dateOfJoin: "วันที่เริ่มงาน",
  phone: "เบอร์โทร",
  email: "อีเมล",
  birthday: "วันเกิด",
  address: "ที่อยู่",
  accountEmail: "อีเมล (ใช้ล็อกอิน)",
};

const SELECTS = new Set(["titleTh", "departmentId", "positionId", "dateOfJoin", "birthday"]);
const THAI = ["titleTh", "firstNameTh", "lastNameTh"];
// The schema requires these; POST /api/employees also requires the address.
const BASE = ["firstName", "lastName", "departmentId", "positionId", "dateOfJoin", "phone", "email", "birthday"];

const clean = (v) => (typeof v === "string" ? v.trim() : v ? String(v) : "");

/**
 * Keys of the required fields. `mode` "create" | "edit"; `createLogin` adds
 * the account email (create); `stored` = the saved employee (edit).
 */
export function requiredFields({ mode = "create", createLogin = false, stored = {} } = {}) {
  const thai = mode === "create" ? THAI : THAI.filter((k) => clean(stored[k]));
  const keys = [...thai, ...BASE];
  if (mode === "create") keys.push("address");
  if (mode === "create" && createLogin) keys.push("accountEmail");
  return keys;
}

/**
 * Validate. Returns { field: message } in form order — empty when valid.
 * `values` holds the same keys as FIELD_LABELS.
 */
export function validateEmployeeForm(values = {}, { mode = "create", createLogin = false, stored = {} } = {}) {
  const required = new Set(requiredFields({ mode, createLogin, stored }));
  const changed = (k) => mode === "create" || clean(values[k]) !== clean(stored[k]);
  const errors = {};
  for (const key of Object.keys(FIELD_LABELS)) {
    const value = clean(values[key]);
    if (!value) {
      if (required.has(key)) errors[key] = `${SELECTS.has(key) ? "กรุณาเลือก" : "กรุณากรอก"}${FIELD_LABELS[key]}`;
      continue;
    }
    if (key === "titleTh" && !TITLES_TH.includes(value)) errors[key] = "คำนำหน้าชื่อต้องเป็น นาย / นาง / นางสาว";
    if (key === "phone" && changed(key) && !PHONE_RE.test(value)) errors[key] = "เบอร์โทรต้องเป็นตัวเลข 10 หลัก";
    if ((key === "email" || key === "accountEmail") && changed(key) && !EMAIL_RE.test(value)) {
      errors[key] = "รูปแบบอีเมลไม่ถูกต้อง";
    }
  }
  if (!(mode === "create" && createLogin)) delete errors.accountEmail;
  return errors;
}

/**
 * Which field a server error message is about, when it says so — the API
 * returns `field`, or the message names a Thai-name label. null otherwise.
 */
export function fieldFromServerError(body = {}) {
  if (body?.field && FIELD_LABELS[body.field]) return body.field;
  const msg = String(body?.message || "");
  if (msg.includes("คำนำหน้าชื่อ")) return "titleTh";
  if (msg.includes("นามสกุล (ไทย)")) return "lastNameTh";
  if (msg.includes("ชื่อ (ไทย)")) return "firstNameTh";
  return null;
}
