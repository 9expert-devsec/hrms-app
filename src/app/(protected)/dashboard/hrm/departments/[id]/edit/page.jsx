export const dynamic = "force-dynamic";

import dbConnect from "@/lib/mongoose";
import { requirePage } from "@/lib/rbac/guard";
import Department from "@/models/Department";
import Employee from "@/models/Employee";
import DepartmentEditForm from "./DepartmentEditForm";

export default async function DepartmentEditPage({ params }) {
  const { id } = await params; // ✅ ต้อง await
  await requirePage("departments");
  await dbConnect();

  const dept = await Department.findById(id)
    .lean()
    .populate("headOfDepartment", "_id firstName lastName position level");

  if (!dept) return <div className="p-6" style={{ color: "#5E6A7E" }}>Department not found</div>;

  // L5–L6 as before, plus the current head whatever their level (Settings ›
  // กำหนด HOD can pick anyone), so the select always shows who it is.
  const currentHeadId = dept.headOfDepartment?._id;
  const eligible = await Employee.find(
    currentHeadId ? { $or: [{ level: { $in: [5, 6] } }, { _id: currentHeadId }] } : { level: { $in: [5, 6] } }
  )
    .select("_id firstName lastName nickName position level userId")
    .lean();

  return (
    <div className="px-6 py-6 container mx-auto">
      <h1 className="text-2xl font-semibold mb-4" style={{ color: "#0D1B2A" }}>Edit Department</h1>
      <DepartmentEditForm
        initial={JSON.parse(JSON.stringify(dept))}
        employeeCount={0}
        eligibleHeads={JSON.parse(JSON.stringify(eligible))}
      />
    </div>
  );
}
