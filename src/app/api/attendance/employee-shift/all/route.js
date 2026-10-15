import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import EmployeeShift from "@/lib/models/EmployeeShift";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gate = await requirePageApi("shift_assign");
    if (gate.res) return gate.res;

    await dbConnect();

    const assignments = await EmployeeShift.find({
      $or: [
        { endDate: null },
        { endDate: { $exists: false } },
      ],
    })
      .populate("employeeId", "_id firstName lastName department")
      .populate("shiftId", "_id name startTime endTime")
      .sort({ effectiveDate: -1 })
      .lean();

    // Deduplicate — keep only latest assignment per employee
    const seen = new Set();
    const latest = assignments.filter((a) => {
      const id = a.employeeId?._id?.toString();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    return NextResponse.json({ ok: true, assignments: latest }, { status: 200 });
  } catch (err) {
    console.error("GET /api/attendance/employee-shift/all error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}
