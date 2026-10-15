import "server-only";
import Role from "@/models/Role";
import Department from "@/models/Department";
import DepartmentHead from "@/models/DepartmentHead";
import { SEED_ROLES, FALLBACK_ROLE_KEY } from "@/lib/rbac/seedRoles";

/**
 * Server-only role lookups. Callers must have called dbConnect() first.
 */

function toRole(doc) {
  return {
    key: doc.key,
    name: doc.name,
    color: doc.color ?? null,
    pages: Array.isArray(doc.pages) ? doc.pages : [],
    isSystem: !!doc.isSystem,
    isSuperadmin: !!doc.isSuperadmin,
  };
}

/**
 * Role by key, or null when the key is unknown: the `roles` collection
 * first, then SEED_ROLES. Use this to VALIDATE a key someone submitted.
 */
export async function findRole(key) {
  const k = typeof key === "string" ? key.trim().toLowerCase() : "";
  if (!k) return null;
  const doc = await Role.findOne({ key: k }).lean();
  if (doc) return toRole(doc);
  const seed = SEED_ROLES.find((r) => r.key === k);
  return seed ? toRole(seed) : null;
}

/**
 * Role by key for a SIGNED-IN user: like findRole, but an unknown key
 * resolves to the employee role (least privilege) with a warning.
 */
export async function getRoleByKey(key) {
  const known = await findRole(key);
  if (known) return known;

  console.warn(`[rbac] unknown role key "${key}" — using "${FALLBACK_ROLE_KEY}"`);
  const fallback = await Role.findOne({ key: FALLBACK_ROLE_KEY }).lean();
  return toRole(fallback ?? SEED_ROLES.find((r) => r.key === FALLBACK_ROLE_KEY));
}

/**
 * _ids (as strings) of the departments this person heads.
 *
 * Source of truth: Department.headOfDepartment (→ Employee).
 * TEMPORARY until round 7 consolidates HOD data: a head recorded only in the
 * old DepartmentHead collection (userId → departmentCode) is included too, by
 * looking the department up by code, so nobody loses HOD access meanwhile.
 */
export async function getHeadOfDepartmentIds({ userId, employeeId }) {
  const ids = new Set();

  if (employeeId) {
    const depts = await Department.find({ headOfDepartment: employeeId }).select("_id").lean();
    depts.forEach((d) => ids.add(String(d._id)));
  }

  if (userId) {
    const legacy = await DepartmentHead.find({ userId }).select("departmentCode").lean();
    const codes = legacy.map((h) => h.departmentCode).filter(Boolean);
    if (codes.length) {
      const depts = await Department.find({ code: { $in: codes } }).select("_id").lean();
      depts.forEach((d) => ids.add(String(d._id)));
    }
  }

  return [...ids];
}
