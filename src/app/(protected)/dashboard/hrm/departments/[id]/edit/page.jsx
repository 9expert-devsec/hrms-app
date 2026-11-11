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
    .populate("headOfDepartment", "_id firstName lastName firstNameTh lastNameTh position level");

  if (!dept) return <div className="p-6" style={{ color: "#5E6A7E" }}>ไม่พบแผนก</div>;

  // Every employee, same list as Settings › กำหนด HOD (so the current head is
  // always in it).
  const eligible = await listHeadCandidates();

  return (
    <div className="-m-6 min-h-full px-4 py-4 md:px-8 md:py-7" style={{ background: "#F5F7FB" }}>
      <div className="mx-auto max-w-[960px] space-y-4">
        <h1 className="flex flex-wrap items-center gap-2 text-[20px] font-bold" style={{ color: "#0D1B2A" }} data-testid="dept-edit-title">
          แก้ไขแผนก <span style={{ color: "#5E6A7E", fontWeight: 600 }}>{dept.code}</span>
        </h1>
        <DepartmentEditForm
          initial={JSON.parse(JSON.stringify(dept))}
          employeeCount={0}
          eligibleHeads={JSON.parse(JSON.stringify(eligible))}
          canClearHead={session.user.isSuperadmin === true}
        />
      </div>
    </div>
  );
}
