/**
 * Pure role rules — shared by the roles editor (browser) and the roles API
 * (server). No server imports; relative .js imports so plain node can load it.
 *
 * Rulings:
 *   - Six system roles (seed keys) cannot be deleted and keep their key;
 *     name, colour and pages are editable.
 *   - `superadmin` is read-only and is the ONLY role that may be isSuperadmin.
 *   - A custom role cannot be deleted while users have it (409).
 *   - New key: ^[a-z][a-z0-9_]{1,31}$, unique across DB and seed keys,
 *     immutable after creation. Name required.
 *   - Submitted pages must all be registry keys; unknown keys are a 400.
 */
import { ALL_PAGE_KEYS } from "./pages.js";
import { SEED_ROLES, SELF } from "./seedRoles.js";

export const SUPERADMIN_KEY = "superadmin";
export const ROLE_KEY_RE = /^[a-z][a-z0-9_]{1,31}$/;
export const SEED_ROLE_KEYS = SEED_ROLES.map((r) => r.key);
/** Keys that would collide with a static route under /api/roles/. */
export const RESERVED_ROLE_KEYS = ["request"];
export const DEFAULT_ROLE_COLOR = "#6b7280";
/** A new role starts with the self-service pages ticked (removable). */
export const NEW_ROLE_PAGES = [...SELF];

/** '#abc' / '#aabbcc' (any case, '#' optional) → '#aabbcc', else null. */
export function normalizeHex(value) {
  if (typeof value !== "string") return null;
  let hex = value.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(hex)) hex = hex.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : null;
}

export function isSystemRoleKey(key) {
  return SEED_ROLE_KEYS.includes(key);
}

/** Every role except superadmin can be edited (name, colour, pages). */
export function isEditableRole(role) {
  return !!role && role.key !== SUPERADMIN_KEY;
}

/**
 * Key for a NEW role. `existingKeys` = keys of DB roles (seed keys are always
 * checked). Returns a Thai error message, or null when valid.
 */
export function validateRoleKey(key, existingKeys = []) {
  if (typeof key !== "string" || !key) return "กรุณาระบุรหัสบทบาท";
  if (!ROLE_KEY_RE.test(key)) {
    return "รหัสบทบาทต้องขึ้นต้นด้วยตัวอักษร a–z ตามด้วย a–z, 0–9 หรือ _ ยาว 2–32 ตัว";
  }
  if (RESERVED_ROLE_KEYS.includes(key)) return `ใช้รหัส "${key}" ไม่ได้ (สงวนไว้สำหรับระบบ)`;
  if (SEED_ROLE_KEYS.includes(key) || existingKeys.includes(key)) return `มีบทบาทรหัส "${key}" อยู่แล้ว`;
  return null;
}

export function validateRoleName(name) {
  if (typeof name !== "string" || !name.trim()) return "กรุณาระบุชื่อบทบาท";
  if (name.trim().length > 80) return "ชื่อบทบาทยาวเกิน 80 ตัวอักษร";
  return null;
}

/** Returns { ok: true, pages } (deduplicated) or { ok: false, error, unknown }. */
export function validateRolePages(pages) {
  if (!Array.isArray(pages) || pages.some((p) => typeof p !== "string")) {
    return { ok: false, error: "รายการสิทธิ์ต้องเป็นอาร์เรย์ของรหัสหน้า", unknown: [] };
  }
  const known = new Set(ALL_PAGE_KEYS);
  const unknown = [...new Set(pages.filter((p) => !known.has(p)))];
  if (unknown.length) {
    return { ok: false, error: `ไม่รู้จักรหัสสิทธิ์: ${unknown.join(", ")}`, unknown };
  }
  return { ok: true, pages: [...new Set(pages)] };
}

/** Only the `superadmin` key may carry isSuperadmin. Error message or null. */
export function validateSuperadminFlag(key, isSuperadmin) {
  if (isSuperadmin === true && key !== SUPERADMIN_KEY) {
    return "มีเพียงบทบาท superadmin เท่านั้นที่มีสิทธิ์ทุกหน้าได้";
  }
  return null;
}

/**
 * May this role be deleted? `role` needs { key, isSystem }.
 * Returns { ok: true } or { ok: false, status, error }.
 */
export function canDeleteRole(role, userCount = 0) {
  if (!role) return { ok: false, status: 404, error: "ไม่พบบทบาท" };
  if (role.key === SUPERADMIN_KEY) return { ok: false, status: 403, error: "ลบบทบาท superadmin ไม่ได้" };
  if (role.isSystem || isSystemRoleKey(role.key)) {
    return { ok: false, status: 403, error: "ลบบทบาทของระบบไม่ได้" };
  }
  if (userCount > 0) {
    return { ok: false, status: 409, error: `ยังมีผู้ใช้ ${userCount} คนในบทบาทนี้ — ย้ายผู้ใช้ออกก่อนจึงจะลบได้` };
  }
  return { ok: true };
}

/**
 * Validate an editor submission. mode "create" checks the key; mode
 * "update" refuses any key change and any edit of superadmin.
 * Returns { ok: true, value: { key, name, color, pages } } or
 * { ok: false, status, error }.
 */
export function validateRoleInput(input, { mode, currentKey = null, existingKeys = [] } = {}) {
  const body = input || {};
  const key = mode === "create" ? String(body.key ?? "").trim() : currentKey;

  if (mode === "update") {
    if (currentKey === SUPERADMIN_KEY) return { ok: false, status: 403, error: "บทบาท superadmin แก้ไขไม่ได้" };
    if (body.key !== undefined && body.key !== currentKey) {
      return { ok: false, status: 400, error: "เปลี่ยนรหัสบทบาทไม่ได้" };
    }
  } else {
    const keyErr = validateRoleKey(key, existingKeys);
    if (keyErr) return { ok: false, status: keyErr.startsWith("มีบทบาทรหัส") ? 409 : 400, error: keyErr };
  }

  const flagErr = validateSuperadminFlag(key, body.isSuperadmin);
  if (flagErr) return { ok: false, status: 400, error: flagErr };

  const nameErr = validateRoleName(body.name);
  if (nameErr) return { ok: false, status: 400, error: nameErr };

  const pages = validateRolePages(body.pages ?? []);
  if (!pages.ok) return { ok: false, status: 400, error: pages.error };

  let color = DEFAULT_ROLE_COLOR;
  if (body.color !== undefined && body.color !== null && body.color !== "") {
    color = normalizeHex(body.color);
    if (!color) return { ok: false, status: 400, error: "สีไม่ถูกต้อง (ใช้รูปแบบ #rrggbb)" };
  }

  return { ok: true, value: { key, name: body.name.trim(), color, pages: pages.pages } };
}
