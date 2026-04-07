// src/app/api/leave/pending/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import dbConnect from "@/lib/mongoose";
import Leave from "@/models/Leave";
import DepartmentHead from "@/models/DepartmentHead";
import Employee from "@/models/Employee";

const POPULATE_FIELDS = "firstName lastName department position empId photoUrl";

export async function GET(req) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const role = session.user.role || "employee";
    if (!["superadmin", "hr", "manager", "hod"].includes(role)) {
      return NextResponse.json({ ok: false, message: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
    }

    const userId = session.user.id || session.user._id || session.user.sub;
    const { searchParams } = new URL(req.url);
    const step = searchParams.get("step"); // "hod" or "hr"

    console.log("[leave/pending] role:", role, "| step:", step, "| userId:", userId);

    // ── Step HR: show all hod_approved leaves ──
    if (step === "hr") {
      const items = await Leave.find({ status: "hod_approved" })
        .populate("employeeId", POPULATE_FIELDS)
        .sort({ createdAt: -1 })
        .lean();

      console.log("[leave/pending] HR step — hod_approved leaves found:", items.length);
      return NextResponse.json({ ok: true, items });
    }

    // ── Step HOD: show pending leaves from HOD's department ──
    if (step === "hod") {
      // 1. Try DepartmentHead model — explicit HOD assignment
      const hodRecord = await DepartmentHead.findOne({ userId }).lean();

      // 2. Fallback: find the user's own department via Employee model
      const hodEmployee = await Employee.findOne({
        $or: [{ userId }, { email: session.user.email }],
      })
        .select("department")
        .lean();

      const deptCode = hodRecord?.departmentCode || null;

      console.log("[leave/pending] HOD step — role:", role, "| hodRecord:", hodRecord?.departmentCode, "| empDept:", hodEmployee?.department, "| deptCode:", deptCode);

      // 3. If explicit DepartmentHead record exists → scope to that department
      if (deptCode) {
        const deptEmployees = await Employee.find({ department: deptCode })
          .select("_id")
          .lean();
        const employeeIds = deptEmployees.map((e) => e._id);

        console.log("[leave/pending] Employees in dept", deptCode, ":", employeeIds.length);

        const items = await Leave.find({
          status: "pending",
          employeeId: { $in: employeeIds },
        })
          .populate("employeeId", POPULATE_FIELDS)
          .sort({ createdAt: -1 })
          .lean();

        console.log("[leave/pending] Pending leaves found:", items.length);
        return NextResponse.json({ ok: true, items });
      }

      // 4. No DepartmentHead record — check if manager/superadmin → show ALL pending leaves
      //    (general manager or superadmin acting as HOD can see all departments)
      if (role === "manager" || role === "superadmin") {
        console.log("[leave/pending] No DepartmentHead record, role is", role, "→ showing all pending leaves");

        const items = await Leave.find({ status: "pending" })
          .populate("employeeId", POPULATE_FIELDS)
          .sort({ createdAt: -1 })
          .lean();

        console.log("[leave/pending] All pending leaves found:", items.length);
        return NextResponse.json({ ok: true, items });
      }

      // 5. HOD role without DepartmentHead record → scope to own department
      if (hodEmployee?.department) {
        const deptEmployees = await Employee.find({ department: hodEmployee.department })
          .select("_id")
          .lean();

        const items = await Leave.find({
          status: "pending",
          employeeId: { $in: deptEmployees.map((e) => e._id) },
        })
          .populate("employeeId", POPULATE_FIELDS)
          .sort({ createdAt: -1 })
          .lean();

        console.log("[leave/pending] HOD own dept", hodEmployee.department, "— leaves:", items.length);
        return NextResponse.json({ ok: true, items });
      }

      return NextResponse.json({ ok: true, items: [], message: "No department assigned" });
    }

    // ── No step param: auto-route based on role (backwards compat) ──
    if (role === "hr") {
      const items = await Leave.find({ status: "hod_approved" })
        .populate("employeeId", POPULATE_FIELDS)
        .sort({ createdAt: -1 })
        .lean();
      return NextResponse.json({ ok: true, items });
    }

    if (role === "manager" || role === "hod") {
      const hodRecord = await DepartmentHead.findOne({ userId }).lean();

      // Explicit DepartmentHead → scope to that department
      if (hodRecord?.departmentCode) {
        const deptEmployees = await Employee.find({ department: hodRecord.departmentCode }).select("_id").lean();
        const items = await Leave.find({
          status: "pending",
          employeeId: { $in: deptEmployees.map((e) => e._id) },
        })
          .populate("employeeId", POPULATE_FIELDS)
          .sort({ createdAt: -1 })
          .lean();
        return NextResponse.json({ ok: true, items });
      }

      // Manager without DepartmentHead → show all pending
      if (role === "manager") {
        const items = await Leave.find({ status: "pending" })
          .populate("employeeId", POPULATE_FIELDS)
          .sort({ createdAt: -1 })
          .lean();
        return NextResponse.json({ ok: true, items });
      }

      // HOD role → fallback to own department
      const hodEmployee = await Employee.findOne({
        $or: [{ userId }, { email: session.user.email }],
      }).select("department").lean();

      if (hodEmployee?.department) {
        const deptEmployees = await Employee.find({ department: hodEmployee.department }).select("_id").lean();
        const items = await Leave.find({
          status: "pending",
          employeeId: { $in: deptEmployees.map((e) => e._id) },
        })
          .populate("employeeId", POPULATE_FIELDS)
          .sort({ createdAt: -1 })
          .lean();
        return NextResponse.json({ ok: true, items });
      }

      return NextResponse.json({ ok: true, items: [] });
    }

    // superadmin without step param — default to hod_approved
    if (role === "superadmin") {
      const items = await Leave.find({ status: "hod_approved" })
        .populate("employeeId", POPULATE_FIELDS)
        .sort({ createdAt: -1 })
        .lean();
      return NextResponse.json({ ok: true, items });
    }

    return NextResponse.json({ ok: false, message: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
  } catch (err) {
    console.error("GET /api/leave/pending error:", err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
