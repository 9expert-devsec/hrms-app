// src/app/(protected)/dashboard/hrm/employee/edit/page.jsx
import Link from "next/link";
import Image from "next/image";
import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import User from "@/models/User";
import { requirePage } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import EmployeeEditForm from "./EmployeeEditForm";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({ searchParams }) {
  const session = await requirePage("employees");
  if (!searchParams?.id) {
    return (
      <div className="p-6">
        <p className="text-slate-300">Missing ?id in query.</p>
        <Link href="/dashboard/hrm/employee" className="text-indigo-300">← Back</Link>
      </div>
    );
  }

  await dbConnect();
  const emp = await Employee.findById(searchParams.id).lean();
  if (!emp) {
    return (
      <div className="p-6">
        <p className="text-slate-300">Employee not found.</p>
        <Link href="/dashboard/hrm/employee" className="text-indigo-300">← Back</Link>
      </div>
    );
  }

  // โหลด departments สำหรับ select ตำแหน่ง/เลเวล
  const deps = await Department.find({})
    .select("_id code name empIdPrefix positions")
    .lean();

  // หา user ที่ผูกกับ employee คนนี้
  let user = await User.findOne({ employeeId: emp._id })
    .select("_id email role")
    .lean();

  // fallback (กรณีเก่าที่ยังไม่ผูก employeeId)
  if (!user && emp.email) {
    user = await User.findOne({ email: emp.email }).select("_id email role").lean();
  }

  const canAdmin = canAccess(session.user, "employees");

  return (
    <div className="px-6 py-6 container mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Edit Employee</h1>
          <p className="text-slate-400 text-sm">{emp.firstName} {emp.lastName}</p>
        </div>
        <Link
          href={`/dashboard/hrm/employee-profile?id=${emp._id}`}
          className="rounded-xl bg-white/10 ring-1 ring-white/10 px-4 py-2 text-slate-200 hover:bg-white/15"
        >
          ← Back to profile
        </Link>
      </div>

      <EmployeeEditForm
        employee={JSON.parse(JSON.stringify(emp))}
        departments={JSON.parse(JSON.stringify(deps))}
        linkedUser={user ? JSON.parse(JSON.stringify(user)) : null}
        canAdmin={canAdmin}
      />
    </div>
  );
}
