/**
 * Employee names. Pure — safe in the browser.
 *
 * Every employee has an English name (firstName / lastName). The Thai name
 * (titleTh + firstNameTh + lastNameTh) is required for new employees and
 * filled in over time for existing ones, so every display falls back to
 * English while the Thai name is incomplete.
 *
 * Projections feeding these helpers must include EMPLOYEE_NAME_FIELDS,
 * otherwise they silently fall back to English.
 */

export const TITLES_TH = ["นาย", "นาง", "นางสาว"];

/** Fields to .select()/populate() wherever a name is shown. */
export const EMPLOYEE_NAME_FIELDS = "firstName lastName titleTh firstNameTh lastNameTh nickName";

const clean = (v) => (typeof v === "string" ? v.trim() : "");

/** "firstNameTh lastNameTh" when both are present, else "firstName lastName" (no title). */
export function employeeDisplayName(emp) {
  if (!emp) return "";
  const th = [clean(emp.firstNameTh), clean(emp.lastNameTh)];
  if (th[0] && th[1]) return th.join(" ");
  return [clean(emp.firstName), clean(emp.lastName)].filter(Boolean).join(" ");
}

/** Formal Thai form, title joined without a space ("นายสมชาย ใจดี"), or "" if incomplete. */
export function employeeFullNameTh(emp) {
  const title = clean(emp?.titleTh);
  const first = clean(emp?.firstNameTh);
  const last = clean(emp?.lastNameTh);
  if (!TITLES_TH.includes(title) || !first || !last) return "";
  return `${title}${first} ${last}`;
}

/** English full name ("firstName lastName"). */
export function employeeNameEn(emp) {
  return [clean(emp?.firstName), clean(emp?.lastName)].filter(Boolean).join(" ");
}

/** Lower-cased text for name search: Thai, English and nickname together. */
export function employeeNameSearchText(emp) {
  return [emp?.firstNameTh, emp?.lastNameTh, emp?.firstName, emp?.lastName, emp?.nickName]
    .map(clean)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Thai-name rules. `mode` "create": all three required. "edit": a value
 * already stored (`current`) may not be cleared; whatever is sent must be
 * valid. Returns a Thai error message, or null.
 */
export function thaiNameError(input = {}, { mode = "create", current = {} } = {}) {
  const labels = { titleTh: "คำนำหน้าชื่อ (ไทย)", firstNameTh: "ชื่อ (ไทย)", lastNameTh: "นามสกุล (ไทย)" };
  for (const key of ["titleTh", "firstNameTh", "lastNameTh"]) {
    const sent = key in input;
    const value = clean(input[key]);
    if (mode === "create" && !value) return `กรุณากรอก${labels[key]}`;
    if (mode === "edit" && sent && !value && clean(current[key])) return `ลบ${labels[key]}ที่กรอกไว้แล้วไม่ได้`;
    if (key === "titleTh" && value && !TITLES_TH.includes(value)) return "คำนำหน้าชื่อต้องเป็น นาย / นาง / นางสาว";
  }
  return null;
}
