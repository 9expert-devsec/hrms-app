import { NextResponse } from "next/server";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import Department from "@/models/Department";
import Employee from "@/models/Employee";
import DepartmentHead from "@/models/DepartmentHead";

export async function POST() {
  try {
    const gate = await requirePageApi("hod_settings");
    if (gate.res) return gate.res;
    const { session } = gate;

    await dbConnect();

    // Find all departments that have a headOfDepartment set
    const depts = await Department.find({
      headOfDepartment: { $ne: null },
    })
      .select("code headOfDepartment")
      .lean();

    let synced = 0;

    for (const dept of depts) {
      if (!dept.code || !dept.headOfDepartment) continue;

      // Find the Employee to get their userId
      const emp = await Employee.findById(dept.headOfDepartment)
        .select("userId")
        .lean();

      if (!emp?.userId) continue;

      // Upsert into DepartmentHead
      await DepartmentHead.findOneAndUpdate(
        { departmentCode: dept.code },
        {
          userId: emp.userId,
          assignedBy: session.user.id || session.user._id,
        },
        { upsert: true, new: true },
      );

      synced++;
    }

    return NextResponse.json({ ok: true, synced });
  } catch (err) {
    console.error("POST /api/department-head/sync error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Server error" }, { status: 500 });
  }
}
