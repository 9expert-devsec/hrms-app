import "server-only";
import Leave from "@/models/Leave";
import LeaveType from "@/models/LeaveType";
import LeaveSettings from "@/models/LeaveSettings";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";
import { fiscalYearOf } from "@/lib/leaveRules";
import { HOURS_PER_DAY, dateKeyOf } from "@/lib/leave/countLeave";
import { LeaveError, quotaSummary } from "@/lib/leave/requests";

/**
 * วันลาคงเหลือ (round 42): the caller's quota per active type for one fiscal
 * year, from the round-39 entitlements / type defaults and the round-40
 * usage (lib/leave/requests.js quotaSummary — used = approved +
 * cancel_requested, pending = pending_approval + pending_hr). Remaining =
 * quota − used − pending, as on ขอลา. Read-only; the old LeaveBalance
 * collection is no longer read. Callers must have called dbConnect().
 */
export async function leaveBalance(session, { fiscalYear = null } = {}) {
  const emp = await getOwnEmployee(session, "_id");
  if (!emp) throw new LeaveError("บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน", 404);
  const settings = await LeaveSettings.findOne({ key: "default" }).select("hoursPerDay fiscalYearStartMonth").lean();
  const hoursPerDay = Number(settings?.hoursPerDay) > 0 ? Number(settings.hoursPerDay) : HOURS_PER_DAY;
  const current = fiscalYearOf(new Date(), settings?.fiscalYearStartMonth || 1);
  const fy = Number.isInteger(Number(fiscalYear)) && Number(fiscalYear) > 2000 ? Number(fiscalYear) : current;

  const types = await LeaveType.find({ isActive: { $ne: false } }).sort({ sortOrder: 1, nameTh: 1 }).lean();
  const [quota, leaves, years] = await Promise.all([
    quotaSummary(emp._id, [fy], types),
    Leave.find({ employeeId: emp._id, fiscalYear: fy, leaveTypeId: { $ne: null } })
      .select("leaveTypeName unit startDate endDate halfDayPeriod startTime endTime totalHours status")
      .sort({ startDate: -1 })
      .lean(),
    Leave.distinct("fiscalYear", { employeeId: emp._id, fiscalYear: { $ne: null } }),
  ]);
  const fiscalYears = [...new Set([current - 1, current, current + 1, ...years])].sort((a, b) => b - a);

  return {
    fiscalYear: fy,
    currentFiscalYear: current,
    fiscalYears,
    hoursPerDay,
    types: types.map((t) => {
      const q = quota[fy][String(t._id)];
      const totalHours = q.quotaDays === null ? null : q.quotaDays * hoursPerDay;
      return {
        _id: String(t._id),
        nameTh: t.nameTh,
        quotaHours: totalHours,
        usedHours: q.usedHours,
        pendingHours: q.pendingHours,
        remainingHours: totalHours === null ? null : totalHours - q.usedHours - q.pendingHours,
      };
    }),
    leaves: leaves.map((l) => ({
      _id: String(l._id),
      leaveTypeName: l.leaveTypeName || "-",
      unit: l.unit,
      startDate: dateKeyOf(l.startDate),
      endDate: dateKeyOf(l.endDate),
      halfDayPeriod: l.halfDayPeriod || null,
      startTime: l.startTime || null,
      endTime: l.endTime || null,
      totalHours: l.totalHours || 0,
      status: l.status,
    })),
  };
}
