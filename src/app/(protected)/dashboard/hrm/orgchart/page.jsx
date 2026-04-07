// src/app/(protected)/dashboard/hrm/orgchart/page.jsx
export const dynamic = "force-dynamic";

import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import { requireSessionPage } from "@/lib/authz";
import OrgFlowClient from "./OrgFlowClient";

export default async function OrgChartPage() {
  await requireSessionPage();
  await dbConnect();

  const deps = await Department.find({})
    .select("_id code name color")
    .lean();

  const emps = await Employee.find({})
    .select("_id firstName lastName nickName position level department departmentId photoUrl")
    .lean();

  return (
    <div className="px-6 py-6">
      <h1 className="text-2xl font-semibold text-slate-100 mb-1">Org Chart</h1>
      <p className="text-slate-400 mb-4">แผนผังโครงสร้างจากข้อมูลจริงในระบบ</p>
      <OrgFlowClient
        departments={JSON.parse(JSON.stringify(deps))}
        employees={JSON.parse(JSON.stringify(emps))}
      />
    </div>
  );
}
