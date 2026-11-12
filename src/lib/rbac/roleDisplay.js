/**
 * How a role is shown on the users and roles pages. Pure — browser-safe.
 *
 *   roleDisplay(key, role) → { name, color }
 *     System roles have fixed Thai names and colours; a custom role shows its
 *     Role document's name and colour (else #64748B).
 *   rolePageCount(role)  → number of registry PAGES (keys with an href) the
 *     role holds that its people can open — in-development pages excluded;
 *     null for superadmin ("ทุกหน้า").
 *   roleDataScope(role)  → one label for how far the role's data reaches.
 */
import { HRMS_PAGES } from "./pages.js";

export const ROLE_DISPLAY = {
  superadmin: { name: "ผู้ดูแลระบบสูงสุด", color: "#DC2626" },
  hr: { name: "ฝ่ายบุคคล", color: "#3B82F6" },
  manager: { name: "ผู้จัดการ", color: "#7C3AED" },
  it: { name: "ฝ่ายไอที", color: "#0891B2" },
  payroll: { name: "ฝ่ายเงินเดือน", color: "#EA580C" },
  employee: { name: "พนักงาน", color: "#64748B" },
};
/** System roles in display order. */
export const SYSTEM_ROLE_ORDER = Object.keys(ROLE_DISPLAY);
export const CUSTOM_ROLE_COLOR = "#64748B";

/** `role` = the Role (document, seed or listRoles item) when known. */
export function roleDisplay(key, role = null) {
  if (ROLE_DISPLAY[key]) return ROLE_DISPLAY[key];
  return { name: (role?.name || "").trim() || key || "—", color: role?.color || CUSTOM_ROLE_COLOR };
}

/** System roles first (fixed order), then custom roles by name. */
export function sortRoles(roles) {
  const rank = (r) => {
    const i = SYSTEM_ROLE_ORDER.indexOf(r.key);
    return i === -1 ? SYSTEM_ROLE_ORDER.length : i;
  };
  return [...roles].sort((a, b) => rank(a) - rank(b) || roleDisplay(a.key, a).name.localeCompare(roleDisplay(b.key, b).name, "th"));
}

const FLAT = HRMS_PAGES.flatMap((g) => g.pages);
const PAGE_KEYS = new Set(FLAT.filter((p) => p.href).map((p) => p.key));
const SCOPE_KEYS = FLAT.filter((p) => p.match === "none");
const IN_DEVELOPMENT = new Set(FLAT.filter((p) => p.inDevelopment).map((p) => p.key));

// In-development pages open for the superadmin only (round 27), so they are
// not counted: the number is how many pages the role's people can open today.
export function rolePageCount(role) {
  if (role?.isSuperadmin) return null;
  return (role?.pages || []).filter((k) => PAGE_KEYS.has(k) && !IN_DEVELOPMENT.has(k)).length;
}

export const SCOPE_LABELS = {
  company: "ทั้งบริษัท",
  accounts: "บัญชีผู้ใช้ทั้งหมด",
  headed: "แผนกที่ดูแล",
  self: "เฉพาะตัวเอง",
};

/**
 * Widest data scope wins:
 *   ทั้งบริษัท          — superadmin, any scope key (every scope key widens
 *                        to all employees / all departments), or a page that
 *                        lists everyone's records: employees, offsite_hr;
 *   บัญชีผู้ใช้ทั้งหมด   — users_manage (every login account);
 *   แผนกที่ดูแล         — an approval page that works on the departments the
 *                        user heads: leave_approve, ot_approve;
 *   เฉพาะตัวเอง         — otherwise (self-service only).
 * Keys flagged inDevelopment grant nothing to non-superadmins today
 * (access.js), so they do not widen the label.
 */
export const COMPANY_PAGE_KEYS = ["employees", "offsite_hr"];
export const ACCOUNTS_PAGE_KEYS = ["users_manage"];
export const HEADED_PAGE_KEYS = ["leave_approve", "ot_approve"];
export const SCOPE_KEY_LIST = SCOPE_KEYS.map((p) => p.key);

export function roleDataScope(role) {
  if (role?.isSuperadmin) return { key: "company", label: SCOPE_LABELS.company };
  const held = new Set((role?.pages || []).filter((k) => !IN_DEVELOPMENT.has(k)));
  const any = (keys) => keys.some((k) => held.has(k));
  const key = any(SCOPE_KEY_LIST) || any(COMPANY_PAGE_KEYS)
    ? "company"
    : any(ACCOUNTS_PAGE_KEYS)
      ? "accounts"
      : any(HEADED_PAGE_KEYS)
        ? "headed"
        : "self";
  return { key, label: SCOPE_LABELS[key] };
}
