import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import { attendanceScope } from "@/lib/rbac/scopes";
import { getOwnEmployee, isEmployeeInScope } from "@/lib/rbac/scopeQueries";
import AttendanceRecord from "@/lib/models/AttendanceRecord";
import Holiday from "@/lib/models/Holiday";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const gate = await requireAnyPageApi(["self_attendance", "self_clock"]);
    if (gate.res) return gate.res;
    const { session } = gate;

    await dbConnect();

    const url = new URL(req.url);
    const monthParam = Number(url.searchParams.get("month")) || (new Date().getMonth() + 1);
    const yearParam = Number(url.searchParams.get("year")) || new Date().getFullYear();
    const employeeIdParam = url.searchParams.get("employeeId");

    // Another employee only with scope_attendance_all or as their head;
    // otherwise always the caller's own records.
    let targetId =
      employeeIdParam && (await isEmployeeInScope(attendanceScope(session.user), employeeIdParam))
        ? employeeIdParam
        : null;
    if (!targetId) {
      const emp = await getOwnEmployee(session, "_id");
      if (!emp) {
        return NextResponse.json({ ok: true, data: { month: `${yearParam}-${String(monthParam).padStart(2, "0")}`, employeeId: null, days: [] } });
      }
      targetId = String(emp._id);
    }

    // Date range for the month
    const startDate = new Date(Date.UTC(yearParam, monthParam - 1, 1));
    const daysInMonth = new Date(yearParam, monthParam, 0).getDate();
    const endDate = new Date(Date.UTC(yearParam, monthParam - 1, daysInMonth, 23, 59, 59));

    // Fetch attendance records + holidays in parallel
    const [records, holidays] = await Promise.all([
      AttendanceRecord.find({
        employeeId: targetId,
        date: { $gte: startDate, $lte: endDate },
      }).lean(),
      Holiday.find({
        date: { $gte: startDate, $lte: endDate },
      }).lean(),
    ]);

    // Build lookup maps
    const recordMap = {};
    for (const r of records) {
      const ds = new Date(r.date).toISOString().slice(0, 10);
      recordMap[ds] = r;
    }

    const holidayMap = {};
    for (const h of holidays) {
      const ds = new Date(h.date).toISOString().slice(0, 10);
      holidayMap[ds] = h;
    }

    // Build day-by-day array
    const todayStr = new Date().toISOString().slice(0, 10);
    const days = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(yearParam, monthParam - 1, d);
      const dateStr = `${yearParam}-${String(monthParam).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

      // Weekend
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        days.push({ date: dateStr, status: "weekend" });
        continue;
      }

      // Holiday (check before attendance — holiday overrides absent)
      const hol = holidayMap[dateStr];
      if (hol) {
        days.push({ date: dateStr, status: "holiday", holidayName: hol.name, holidayType: hol.type });
        continue;
      }

      // Check attendance record
      const rec = recordMap[dateStr];
      if (rec) {
        days.push({
          date: dateStr,
          status: rec.status || "present",
          clockIn: rec.clockIn,
          clockOut: rec.clockOut,
          workHours: rec.workHours,
          lateMinutes: rec.lateMinutes,
          otHours: rec.otHours,
          note: rec.note,
          _id: rec._id,
        });
        continue;
      }

      // Future date
      if (dateStr > todayStr) {
        days.push({ date: dateStr, status: null });
        continue;
      }

      // Past working day with no record
      days.push({ date: dateStr, status: "absent" });
    }

    return NextResponse.json({
      ok: true,
      data: {
        month: `${yearParam}-${String(monthParam).padStart(2, "0")}`,
        employeeId: targetId,
        days,
      },
    });
  } catch (err) {
    console.error("GET /api/attendance/records error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}
