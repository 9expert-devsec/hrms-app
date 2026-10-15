// Server Component
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import dbConnect from "@/lib/mongoose";
import Department from "@/models/Department";
import Employee from "@/models/Employee";
import { Plus } from "lucide-react";
import DepartmentsClient from "../departments/ui/DepartmentsClient";

export const dynamic = "force-dynamic";

// ลำดับแผนกที่ต้องการ
const DEPT_ORDER = ["MD","EX","HR","AC","IT","TR","MK","SD","AM","FM","ME"];

export default async function DepartmentsPage() {
  await dbConnect();

  // ดึงแผนก
  const departments = await Department.find({}).sort({ code: 1 }).lean();

  // นับจำนวนพนักงานแบบไม่ซ้ำ (เลือก key เดียวต่อคน)
  // deptKey = String(departmentId) ถ้ามี, ถ้าไม่มีก็ใช้ department (code)
  const counts = await Employee.aggregate([
    {
      $match: {
        $or: [
          { departmentId: { $exists: true, $ne: null } },
          { department: { $exists: true, $type: "string", $ne: "" } },
        ],
      },
    },
    {
      $addFields: {
        deptKey: { $ifNull: [{ $toString: "$departmentId" }, "$department"] },
      },
    },
    { $group: { _id: "$deptKey", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

  // ผูก count กลับให้แต่ละแผนก (ลองด้วย _id ก่อน, ถ้าไม่เจอใช้ code)
  const enriched = departments.map((d) => {
    const k1 = String(d._id);
    const k2 = d.code;
    const c = countMap[k1] ?? countMap[k2] ?? 0;
    return { ...d, _empCount: c };
  });

  // จัดลำดับตาม DEPT_ORDER
  const ordered = [...enriched].sort((a, b) => {
    const ia = DEPT_ORDER.indexOf(a.code);
    const ib = DEPT_ORDER.indexOf(b.code);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.code.localeCompare(b.code);
  });

  // สิทธิ์
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "employee";
  const canEdit = ["superadmin", "hr"].includes(role);

  return (
    <div className="px-6 py-6 container mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "#0D1B2A" }}>Departments</h1>
          <p className="text-sm" style={{ color: "#5E6A7E" }}>ข้อมูลแผนกจากฐานข้อมูล</p>
        </div>

        {canEdit && (
          <Link
            href="/dashboard/hrm/departments/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 font-medium transition-colors duration-150"
            style={{ background: "#005CFF", color: "#FFFFFF", borderRadius: "10px" }}
          >
            <Plus size={18} />
            Create Department
          </Link>
        )}
      </header>

      <DepartmentsClient
        initialItems={JSON.parse(JSON.stringify(ordered))}
        canEdit={canEdit}
      />
    </div>
  );
}
