import "server-only";
import Role from "@/models/Role";
import User from "@/models/User";
import { SEED_ROLES } from "@/lib/rbac/seedRoles";
import {
  SUPERADMIN_KEY,
  canDeleteRole,
  isSystemRoleKey,
  validateRoleInput,
} from "@/lib/rbac/roleRules";
import { findRole } from "@/lib/rbac/resolveRole";

/**
 * Server side of the roles editor. Every rule lives in roleRules.js; this
 * file applies them against the DB. Callers must have called dbConnect().
 * Permission changes reach signed-in users through the JWT refresh in
 * lib/authOptions.js (ROLE_REFRESH_MS), not here.
 */

/** Thrown for a refused request; `status` is the HTTP status to answer with. */
export class RoleError extends Error {
  constructor(message, status, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

async function userCounts() {
  const rows = await User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [r._id, r.count]));
}

function shape(role, { source, userCount }) {
  return {
    key: role.key,
    name: role.name,
    color: role.color ?? null,
    pages: role.key === SUPERADMIN_KEY ? [] : Array.isArray(role.pages) ? role.pages : [],
    isSystem: isSystemRoleKey(role.key),
    isSuperadmin: role.key === SUPERADMIN_KEY,
    source,
    userCount,
  };
}

/**
 * Every role: each seed role merged with its DB document (if any), then the
 * custom DB roles. Each with userCount and source "db" | "seed".
 */
export async function listRoles() {
  const [docs, counts] = await Promise.all([Role.find({}).lean(), userCounts()]);
  const byKey = new Map(docs.map((d) => [d.key, d]));

  const system = SEED_ROLES.map((seed) => {
    const doc = byKey.get(seed.key);
    return shape(doc ? { ...seed, ...doc } : seed, {
      source: doc ? "db" : "seed",
      userCount: counts.get(seed.key) ?? 0,
    });
  });
  const custom = docs
    .filter((d) => !isSystemRoleKey(d.key))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((d) => shape(d, { source: "db", userCount: counts.get(d.key) ?? 0 }));

  return [...system, ...custom];
}

/** Create a custom role. Starts as given by the editor (SELF pre-ticked there). */
export async function createRole(input, actor) {
  const existing = await Role.find({}).select("key").lean();
  const checked = validateRoleInput(input, { mode: "create", existingKeys: existing.map((r) => r.key) });
  if (!checked.ok) throw new RoleError(checked.error, checked.status);

  const { key, name, color, pages } = checked.value;
  try {
    const doc = await Role.create({
      key,
      name,
      color,
      pages,
      isSystem: false,
      isSuperadmin: false,
      createdBy: actor?.id ?? null,
    });
    return shape(doc.toObject(), { source: "db", userCount: 0 });
  } catch (err) {
    if (err?.code === 11000) throw new RoleError(`มีบทบาทรหัส "${key}" อยู่แล้ว`, 409);
    throw err;
  }
}

/**
 * Update a role's name, colour and pages. A system role with no document yet
 * gets one (upsert). superadmin is read-only; the key never changes.
 */
export async function saveRole(key, input, actor) {
  const current = await findRole(key);
  if (!current) throw new RoleError("ไม่พบบทบาท", 404);

  const checked = validateRoleInput(input, { mode: "update", currentKey: current.key });
  if (!checked.ok) throw new RoleError(checked.error, checked.status);

  const { name, color, pages } = checked.value;
  const doc = await Role.findOneAndUpdate(
    { key: current.key },
    {
      $set: { name, color, pages, isSuperadmin: false },
      $setOnInsert: { key: current.key, isSystem: isSystemRoleKey(current.key), createdBy: actor?.id ?? null },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();

  const count = await User.countDocuments({ role: current.key });
  return shape(doc, { source: "db", userCount: count });
}

/** Delete a custom role; refused for system roles and while users have it. */
export async function deleteRole(key) {
  const doc = await Role.findOne({ key }).lean();
  const role = doc ?? (isSystemRoleKey(key) ? { key, isSystem: true } : null);
  const count = role ? await User.countDocuments({ role: key }) : 0;

  const verdict = canDeleteRole(role, count);
  if (!verdict.ok) throw new RoleError(verdict.error, verdict.status, { userCount: count });

  await Role.deleteOne({ key });
  return { key };
}

/**
 * Validate a role key someone is assigning to a User. Returns the role, or
 * throws RoleError (400 unknown key; 403 superadmin role by a non-superadmin).
 */
export async function assertAssignableRole(key, actor) {
  const role = await findRole(key);
  if (!role) throw new RoleError(`ไม่รู้จักบทบาท "${key}"`, 400);
  if (role.isSuperadmin && actor?.isSuperadmin !== true) {
    throw new RoleError("เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่กำหนดบทบาทนี้ได้", 403);
  }
  return role;
}
