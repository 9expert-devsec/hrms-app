export const dynamic = "force-dynamic";

import dbConnect from "@/lib/mongoose";
import { requirePage } from "@/lib/rbac/guard";
import Department from "@/models/Department";
import { listHeadCandidates } from "@/lib/hod";
import DepartmentEditForm from "./DepartmentEditForm";

export default async function DepartmentEditPage({ params }) {
  const { id } = await params; // ✅ ต้อง await
  const session = await requirePage("departments");
  await dbConnect();

  const dept = await Department.findById(id)
    .lean()
    .populate("headOfDepartment", "_id firstName lastName position level");

  if (!dept) return <div className="p-6" style={{ color: "#5E6A7E" }}>Department not found</div>;

  // Every employee, same list as Settings › กำหนด HOD (so the current head is
  // always in it).
  const eligible = await listHeadCandidates();

  return (
    <div className="px-6 py-6 container mx-auto">
      <h1 className="text-2xl font-semibold mb-4" style={{ color: "#0D1B2A" }}>Edit Department</h1>
      <DepartmentEditForm
        initial={JSON.parse(JSON.stringify(dept))}
        employeeCount={0}
        eligibleHeads={JSON.parse(JSON.stringify(eligible))}
        canClearHead={session.user.isSuperadmin === true}
      />
    </div>
  );
}
