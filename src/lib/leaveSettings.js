import "server-only";
import mongoose from "mongoose";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import User from "@/models/User";
import LeaveType from "@/models/LeaveType";
import LeaveSettings from "@/models/LeaveSettings";
import LeaveEntitlement from "@/models/LeaveEntitlement";
import { sortDepartments, compareDepartments } from "@/lib/departmentOrder";
import { employeeDisplayName, employeeNameSearchText } from "@/lib/employeeName";
import { normalizePhotoCrop } from "@/lib/photoCrop";
import { SETTINGS_DEFAULTS, SYSTEM_LEAVE_TYPES, fiscalYearOf, leaveTypeNameKey } from "@/lib/leaveRules";

/**
 * ตั้งค่าการลา — data shared by the settings page and its APIs.
 * Callers must have called dbConnect() first.
 */

/**
 * Seeds the settings singleton and the three system leave types when they
 * are missing. Idempotent (upserts keyed by `key` / `systemKey`; never
 * overwrites what HR changed). Returns what it inserted.
 */
export async function ensureLeaveSetup() {
  const inserted = { settings: false, types: [] };
  const s = await LeaveSettings.updateOne({ key: "default" }, { $setOnInsert: { key: "default", ...SETTINGS_DEFAULTS, hrSigners: [] } }, { upsert: true });
  inserted.settings = s.upsertedCount > 0;
  for (const t of SYSTEM_LEAVE_TYPES) {
    const r = await LeaveType.updateOne(
      { systemKey: t.systemKey },
      { $setOnInsert: { ...t, nameKey: leaveTypeNameKey(t.nameTh), isActive: true, isSystem: true } },
      { upsert: true }
    );
    if (r.upsertedCount) inserted.types.push(t.nameTh);
  }
  return inserted;
}

export async function getLeaveSettings() {
  await ensureLeaveSetup();
  return LeaveSettings.findOne({ key: "default" }).lean();
}

export function serializeSettings(s) {
  return {
    fiscalYearStartMonth: s.fiscalYearStartMonth,
    hoursPerDay: s.hoursPerDay,
    workdayStart: s.workdayStart,
    workdayEnd: s.workdayEnd,
    halfDayMorning: s.halfDayMorning,
    halfDayAfternoon: s.halfDayAfternoon,
    hrSigners: (s.hrSigners || []).map(String),
  };
}

export async function listLeaveTypes() {
  await ensureLeaveSetup();
  const types = await LeaveType.find({}).sort({ sortOrder: 1, nameTh: 1 }).lean();
  return types.map(serializeType);
}

export function serializeType(t) {
  return {
    _id: String(t._id),
    nameTh: t.nameTh,
    formCategory: t.formCategory,
    units: t.units || [],
    defaultQuotaDays: t.defaultQuotaDays ?? null,
    requiresAttachmentFromDays: t.requiresAttachmentFromDays ?? null,
    isActive: t.isActive !== false,
    sortOrder: t.sortOrder ?? 0,
    isSystem: !!t.isSystem,
  };
}

/** How many leaves use a type (blocks deleting it). Counts the round-40 field. */
export async function leaveTypeUsage(typeId) {
  const Leave = mongoose.connection.collection("leaves");
  return Leave.countDocuments({ leaveTypeId: new mongoose.Types.ObjectId(String(typeId)) });
}

/**
 * Every employee for the approvers / quota tabs: department order (round 36)
 * then name; each with its approvers and whether they have a user account.
 */
export async function listLeaveEmployees() {
  const [emps, depts] = await Promise.all([
    Employee.find({})
      .select("firstName lastName titleTh firstNameTh lastNameTh nickName position department departmentId photoUrl photoCrop userId leaveApprover1Id leaveApprover2Id")
      .lean(),
    Department.find({}).select("_id code name color sortOrder").lean(),
  ]);
  const users = await User.find({ _id: { $in: emps.map((e) => e.userId).filter(Boolean) } }).select("_id").lean();
  const withAccount = new Set(users.map((u) => String(u._id)));
  const byId = new Map(depts.map((d) => [String(d._id), d]));
  const byCode = new Map(depts.map((d) => [d.code, d]));
  const deptOf = (e) => (e.departmentId ? byId.get(String(e.departmentId)) : byCode.get(e.department)) || null;

  const rows = emps.map((e) => {
    const d = deptOf(e);
    return {
      _id: String(e._id),
      name: employeeDisplayName(e) || "-",
      search: employeeNameSearchText(e),
      position: (e.position || "").trim(),
      photoUrl: e.photoUrl || null,
      photoCrop: normalizePhotoCrop(e.photoCrop),
      hasAccount: !!e.userId && withAccount.has(String(e.userId)),
      departmentId: d ? String(d._id) : null,
      departmentCode: d?.code || "",
      departmentName: d?.name || "",
      departmentColor: d?.color || null,
      _dept: d,
      approver1Id: e.leaveApprover1Id ? String(e.leaveApprover1Id) : null,
      approver2Id: e.leaveApprover2Id ? String(e.leaveApprover2Id) : null,
    };
  });
  rows.sort((a, b) => {
    if (!a._dept !== !b._dept) return a._dept ? -1 : 1; // no department last
    return (a._dept && b._dept ? compareDepartments(a._dept, b._dept) : 0) || a.name.localeCompare(b.name, "th");
  });
  return {
    employees: rows.map(({ _dept, ...r }) => r),
    departments: sortDepartments(depts).map((d) => ({ _id: String(d._id), code: d.code, name: d.name })),
  };
}

/** Entitlement records of one fiscal year: [{ employeeId, leaveTypeId, quotaDays }]. */
export async function listEntitlements(fiscalYear) {
  const rows = await LeaveEntitlement.find({ fiscalYear }).select("employeeId leaveTypeId quotaDays").lean();
  return rows.map((r) => ({ employeeId: String(r.employeeId), leaveTypeId: String(r.leaveTypeId), quotaDays: r.quotaDays ?? null }));
}

export const currentFiscalYear = (settings, now = new Date()) => fiscalYearOf(now, settings?.fiscalYearStartMonth || 1);

/** Existing Employee ids among `ids` (strings). */
export async function existingEmployeeIds(ids) {
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  const found = await Employee.find({ _id: { $in: valid } }).select("_id").lean();
  return new Set(found.map((e) => String(e._id)));
}
