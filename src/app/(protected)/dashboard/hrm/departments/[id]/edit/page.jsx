export const dynamic = "force-dynamic";

import dbConnect from "@/lib/mongoose";
import { requireSessionPage } from "@/lib/authz";
import Department from "@/models/Department";
import Employee from "@/models/Employee";
import DepartmentEditForm from "./DepartmentEditForm";

export default async function DepartmentEditPage({ params }) {
  const { id } = await params; // ✅ ต้อง await
  await requireSessionPage();
  await dbConnect();

  const dept = await Department.findById(id)
    .lean()
    .populate("headOfDepartment", "_id firstName lastName position level");

  if (!dept) return <div className="p-6 text-slate-200">Department not found</div>;

  const eligible = await Employee.find({ level: { $in: [5, 6] } })
    .select("_id firstName lastName nickName position level")
    .lean();

  return (
    <div className="px-6 py-6 container mx-auto">
      <h1 className="text-2xl font-semibold text-slate-100 mb-4">Edit Department</h1>
      <DepartmentEditForm
        initial={JSON.parse(JSON.stringify(dept))}
        employeeCount={0}
        eligibleHeads={JSON.parse(JSON.stringify(eligible))}
      />
    </div>
  );
}
