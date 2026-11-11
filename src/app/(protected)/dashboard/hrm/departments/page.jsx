// src/app/(protected)/dashboard/hrm/departments/page.jsx
// แผนกและตำแหน่ง — one card per department: head, employee count, positions.
import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePage } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import dbConnect from "@/lib/mongoose";
import Department from "@/models/Department";
import Employee from "@/models/Employee";
import { EMPLOYEE_NAME_FIELDS, employeeDisplayName, employeeFullNameTh } from "@/lib/employeeName";
import DepartmentsClient from "../departments/ui/DepartmentsClient";
import { BTN_PRIMARY, PAGE, PAGE_BG, Summary } from "../../../../../components/hr/hrUi";

export const dynamic = "force-dynamic";

// ลำดับแผนกที่ต้องการ
const DEPT_ORDER = ["MD", "EX", "HR", "AC", "IT", "TR", "MK", "SD", "AM", "FM", "ME"];

export default async function DepartmentsPage() {
  const session = await requirePage("departments");
  await dbConnect();

  const [departments, counts, totalEmployees] = await Promise.all([
    Department.find({})
      .select("_id code name color description positions headOfDepartment")
      .populate("headOfDepartment", `_id ${EMPLOYEE_NAME_FIELDS}`)
      .sort({ code: 1 })
      .lean(),
    // One key per employee: departmentId when set, else the department code.
    Employee.aggregate([
      { $match: { $or: [{ departmentId: { $exists: true, $ne: null } }, { department: { $exists: true, $type: "string", $ne: "" } }] } },
      { $addFields: { deptKey: { $ifNull: [{ $toString: "$departmentId" }, "$department"] } } },
      { $group: { _id: "$deptKey", count: { $sum: 1 } } },
    ]),
    Employee.countDocuments({}),
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

  const items = departments
    .map((d) => {
      const head = d.headOfDepartment && typeof d.headOfDepartment === "object" ? d.headOfDepartment : null;
      return {
        _id: String(d._id),
        code: d.code || "",
        name: d.name || "",
        color: d.color || null,
        description: (d.description || "").trim(),
        headName: head ? employeeFullNameTh(head) || employeeDisplayName(head) || "-" : null,
        positions: (d.positions || []).map((p) => (p?.name || "").trim()).filter(Boolean),
        empCount: countMap[String(d._id)] ?? countMap[d.code] ?? 0,
      };
    })
    .sort((a, b) => {
      const ia = DEPT_ORDER.indexOf(a.code);
      const ib = DEPT_ORDER.indexOf(b.code);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.code.localeCompare(b.code);
    });

  const canEdit = canAccess(session.user, "departments");

  return (
    <div className={PAGE} style={PAGE_BG}>
      <div className="mx-auto max-w-[1360px] space-y-4 md:space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Summary value={items.length} testid="dept-summary">แผนก · พนักงาน {totalEmployees} คน</Summary>
          {canEdit && (
            <Link href="/dashboard/hrm/departments/create" className={BTN_PRIMARY} data-testid="dept-create">
              <Plus size={16} aria-hidden /> เพิ่มแผนก
            </Link>
          )}
        </div>
        <DepartmentsClient items={items} canEdit={canEdit} />
      </div>
    </div>
  );
}
