import "server-only";
import mongoose from "mongoose";
import User from "@/models/User";
import Employee from "@/models/Employee";
import { findRole } from "@/lib/rbac/resolveRole";
import { assertAssignableRole, countActiveSuperadmins, RoleError } from "@/lib/rbac/roles";
import { linkActionBlock, accountDeleteBlock } from "@/lib/rbac/accountRules";
import { forgetCachedPermissions } from "@/lib/rbac/sessionPerms";
import { AccountError, newAccountPassword } from "@/lib/accounts";
import { employeeDisplayName } from "@/lib/employeeName";

/**
 * Employee ↔ account links. Employee.userId is THE link and it is one-to-one:
 * an employee has at most one account, an account belongs to at most one
 * employee. Linking is optional — an account without an employee signs in
 * but has no self-service data. User.employeeId is kept as a mirror on every
 * write here (older rows only have Employee.userId).
 *
 * Who: employees holders and the superadmin create / link / unlink (guard
 * rails in rbac/accountRules.js linkActionBlock); only the superadmin deletes
 * an account (accountDeleteBlock). Deleting keeps the employee and all
 * history; screens show "บัญชีถูกลบ" where a deleted account was referenced.
 *
 * Callers must have called dbConnect() first. Errors are AccountError
 * (`status` = the HTTP status, Thai message).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sameEmail = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

async function loadEmployee(employeeId) {
  if (!mongoose.isValidObjectId(employeeId)) throw new AccountError("ไม่พบพนักงาน", 404);
  const emp = await Employee.findById(employeeId)
    .select("_id email firstName lastName firstNameTh lastNameTh userId")
    .lean();
  if (!emp) throw new AccountError("ไม่พบพนักงาน", 404);
  return emp;
}

async function loadUser(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AccountError("ไม่พบบัญชีผู้ใช้", 404);
  const user = await User.findById(userId).select("_id email role status employeeId").lean();
  if (!user) throw new AccountError("ไม่พบบัญชีผู้ใช้", 404);
  const role = await findRole(user.role);
  return { user, isSuperadmin: !!role?.isSuperadmin };
}

const targetOf = ({ user, isSuperadmin }) => ({ id: user._id, isSuperadmin, status: user.status });

function assertNotBlocked(denied) {
  if (denied) throw new AccountError(denied.error, denied.status);
}

/** The employee's linked account, or null (a dangling userId counts as none). */
async function liveLinkedUser(emp) {
  if (!emp.userId) return null;
  return User.findById(emp.userId).select("_id email role status").lean();
}

/**
 * Point emp.userId at user, atomically: the account is claimed first
 * (User.employeeId null → emp), then the employee (userId still the value we
 * read → user). Either step failing means someone else got there first.
 */
async function claimLink(emp, userId) {
  if (await Employee.exists({ userId, _id: { $ne: emp._id } })) {
    throw new AccountError("บัญชีนี้ผูกกับพนักงานคนอื่นอยู่แล้ว", 409);
  }
  const claimed = await User.updateOne(
    { _id: userId, $or: [{ employeeId: null }, { employeeId: emp._id }] },
    { $set: { employeeId: emp._id } }
  );
  if (!claimed.matchedCount) throw new AccountError("บัญชีนี้ผูกกับพนักงานคนอื่นอยู่แล้ว", 409);

  const linked = await Employee.updateOne({ _id: emp._id, userId: emp.userId ?? null }, { $set: { userId } });
  if (!linked.matchedCount) {
    await User.updateOne({ _id: userId, employeeId: emp._id }, { $set: { employeeId: null } });
    throw new AccountError("พนักงานคนนี้มีบัญชีแล้ว", 409);
  }
  forgetCachedPermissions(userId);
}

/** What the employee page shows: the linked account and the mismatch warning. */
export function accountSummary(emp, user) {
  if (!user) return null;
  return {
    _id: String(user._id),
    email: user.email,
    role: user.role,
    status: user.status || "active",
    emailMismatch: !sameEmail(user.email, emp.email),
  };
}

/**
 * The employee's account (or null) and, for the "link to an existing
 * account" picker, every account no employee links to. A non-superadmin
 * never sees superadmin accounts there (they could not link them).
 */
export async function getEmployeeAccount(employeeId, { actor }) {
  const emp = await loadEmployee(employeeId);
  const user = await liveLinkedUser(emp);

  const linkedIds = await Employee.distinct("userId", { userId: { $ne: null } });
  const free = await User.find({ _id: { $nin: linkedIds } })
    .select("_id email role status")
    .sort({ email: 1 })
    .lean();
  const candidates = [];
  for (const u of free) {
    const isSuperadmin = !!(await findRole(u.role))?.isSuperadmin;
    if (linkActionBlock({ actor, target: { id: u._id, isSuperadmin }, action: "link" })) continue;
    candidates.push({ _id: String(u._id), email: u.email, role: u.role, status: u.status || "active" });
  }
  return { employeeEmail: emp.email || "", account: accountSummary(emp, user), candidates };
}

/**
 * Create an account for an employee who has none. Email defaults to the
 * employee's; the role is "employee" unless a superadmin picks another
 * (assertAssignableRole). Returns { account, tempPassword } — the temporary
 * password exists only in this return value (round 9).
 */
export async function createAccountForEmployee(employeeId, { email, role } = {}, { actor }) {
  const emp = await loadEmployee(employeeId);
  if (await liveLinkedUser(emp)) throw new AccountError("พนักงานคนนี้มีบัญชีแล้ว", 409);

  const accountEmail = String(email || emp.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(accountEmail)) throw new AccountError("อีเมลไม่ถูกต้อง", 400);
  const roleKey = String(role || "employee").trim().toLowerCase();
  try {
    await assertAssignableRole(roleKey, { actor });
  } catch (e) {
    if (e instanceof RoleError) throw new AccountError(e.message, e.status);
    throw e;
  }
  if (await User.exists({ email: accountEmail })) {
    throw new AccountError("อีเมลนี้มีบัญชีอยู่แล้ว — ใช้ “ผูกกับบัญชีที่มีอยู่” แทน", 409);
  }

  const { tempPassword, fields } = await newAccountPassword();
  const name = employeeDisplayName(emp) || accountEmail;
  const user = await User.create({ name, email: accountEmail, role: roleKey, status: "active", ...fields });
  try {
    await claimLink(emp, user._id);
  } catch (e) {
    await User.deleteOne({ _id: user._id });
    throw e;
  }
  return { account: accountSummary(emp, user), tempPassword };
}

/** Link the employee to an existing account that no employee links to. */
export async function linkAccount(employeeId, userId, { actor }) {
  const emp = await loadEmployee(employeeId);
  if (await liveLinkedUser(emp)) throw new AccountError("พนักงานคนนี้มีบัญชีแล้ว — ยกเลิกการผูกก่อน", 409);
  const target = await loadUser(userId);
  assertNotBlocked(linkActionBlock({ actor, target: targetOf(target), action: "link" }));

  await claimLink(emp, target.user._id);
  return { account: accountSummary(emp, target.user) };
}

/** Unlink: Employee.userId → null. The account stays, with its role. */
export async function unlinkAccount(employeeId, { actor }) {
  const emp = await loadEmployee(employeeId);
  if (!emp.userId) throw new AccountError("พนักงานคนนี้ยังไม่ได้ผูกบัญชี", 409);

  const user = await User.findById(emp.userId).select("_id email role status").lean();
  if (user) {
    const isSuperadmin = !!(await findRole(user.role))?.isSuperadmin;
    assertNotBlocked(linkActionBlock({ actor, target: targetOf({ user, isSuperadmin }), action: "unlink" }));
  }

  await Employee.updateOne({ _id: emp._id, userId: emp.userId }, { $set: { userId: null } });
  await User.updateOne({ _id: emp.userId, employeeId: emp._id }, { $set: { employeeId: null } });
  forgetCachedPermissions(emp.userId);
  return { employeeId: String(emp._id), unlinkedUserId: String(emp.userId) };
}

/**
 * Delete an account (superadmin; mistakes and duplicates — suspend people who
 * left). `confirmEmail` must equal the account's email. The employee is
 * unlinked first and kept; leave / OT / attendance history is not touched.
 */
export async function deleteAccount(userId, { actor, confirmEmail }) {
  const target = await loadUser(userId);
  assertNotBlocked(
    accountDeleteBlock({
      actor,
      target: targetOf(target),
      activeSuperadminCount: target.isSuperadmin ? await countActiveSuperadmins() : Infinity,
    })
  );
  if (!sameEmail(confirmEmail, target.user.email)) {
    throw new AccountError("อีเมลที่พิมพ์ยืนยันไม่ตรงกับบัญชีนี้", 400);
  }

  const unlinked = await Employee.updateMany({ userId: target.user._id }, { $set: { userId: null } });
  await User.deleteOne({ _id: target.user._id });
  forgetCachedPermissions(target.user._id);
  return { _id: String(target.user._id), unlinkedEmployees: unlinked.modifiedCount };
}
