import Link from "next/link";
import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import User from "@/models/User";
import Department from "@/models/Department"; // ✅ ดึงสีจาก department
import { requirePage } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import EmployeeGroupsClient from "./EmployeeGroupsClient";
import { employeeDisplayName, employeeNameSearchText } from "@/lib/employeeName";

export const dynamic = "force-dynamic";

// label ตามที่ตกลง (ถ้ามี code ที่ไม่มี label จะ fallback เป็น code เดิม)
const DEPT_LABEL = {
  MD: "Management / Director",
  HR: "Human Resources",
  AC: "Accounting",
  IT: "Information Technology",
  TR: "Training Department",
  MK: "Marketing",
  SD: "Software Development",
  AM: "Academic",
  EX: "Executive Office",
  FM: "Facility Management",
  ME: "Media Department",
};
const DEPT_ORDER = ["MD","EX","HR","AC","IT","TR","MK","SD","AM","ME","FM"];

export default async function EmployeeIndexPage() {
  const session = await requirePage("employees");
  const canCreate = canAccess(session.user, "employees");

  await dbConnect();

  // ✅ ดึงรายชื่อพนักงาน (ข้อมูลเบา ๆ)
  const docs = await Employee.find(
    {},
    "empAutoId firstName lastName titleTh firstNameTh lastNameTh nickName department position phone email photoUrl userId"
  )
    .sort({ department: 1, lastName: 1, firstName: 1 })
    .lean();

  // Has a login account = Employee.userId points at a user that still exists.
  const liveUserIds = new Set(
    (await User.find({ _id: { $in: docs.map((e) => e.userId).filter(Boolean) } }).select("_id").lean()).map(
      (u) => String(u._id)
    )
  );

  // ✅ ดึงสีจาก departments: { code, color }
  const deps = await Department.find({}, "code color").lean();
  const DEPT_COLORS = Object.fromEntries(
    deps.map((d) => [d.code || "", d.color || ""])
  );

  // group by department + เตรียมข้อมูลให้ client
  const groups = {};
  for (const e of docs) {
    const dept = e.department || "UNKNOWN";
    if (!groups[dept]) groups[dept] = [];
    groups[dept].push({
      id: String(e._id),
      empAutoId: e.empAutoId,
      name: employeeDisplayName(e),
      nameSearch: employeeNameSearchText(e),
      nickName: e.nickName,
      position: e.position,
      phone: e.phone,
      email: e.email,
      photoUrl: e.photoUrl || "/avatar-default.png",
      department: dept,
      hasAccount: !!e.userId && liveUserIds.has(String(e.userId)),
    });
  }

  return (
    <div className="px-6 py-6 container mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Employees</h1>
          <p className="text-slate-400 text-sm">แสดงรายชื่อพนักงาน แบ่งตามแผนก</p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/hrm/employee/create"
            className="rounded-xl bg-indigo-600/90 hover:bg-indigo-600 px-4 py-2.5 text-white font-medium ring-1 ring-white/10"
          >
            + Create Employee
          </Link>
        )}
      </div>

      {/* ส่งข้อมูลให้ client component */}
      <EmployeeGroupsClient
        groups={groups}
        order={DEPT_ORDER}
        labels={DEPT_LABEL}
        deptColors={DEPT_COLORS}   // ✅ ส่ง map สีของแผนกไป
      />
    </div>
  );
}
