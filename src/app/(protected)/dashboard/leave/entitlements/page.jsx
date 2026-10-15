// src/app/(protected)/dashboard/leave/entitlements/page.jsx
export const dynamic = "force-dynamic";

import dbConnect from "@/lib/mongoose";
import { requireSuperadminPage } from "@/lib/rbac/guard";
import Employee from "@/models/Employee";
import EntitlementsClient from "./EntitlementsClient";

export default async function LeaveEntitlementsPage() {
  // Not in the registry (orphan page): superadmin only.
  await requireSuperadminPage();
  await dbConnect();

  // รายชื่อพนักงาน (เอาเฉพาะ active ก็ได้ถ้ามีฟิลด์)
  const emps = await Employee.find({})
    .select("_id firstName lastName nickName position level department departmentId photoUrl")
    .lean();

  const employees = emps.map((e) => ({
    _id: String(e._id),
    name: [e.firstName, e.lastName].filter(Boolean).join(" ") || e.nickName || "-",
    position: e.position || "",
    level: e.level || null,
    photoUrl: e.photoUrl || "",
  }));

  return (
    <div className="px-6 py-6 container mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-slate-100 mb-2">สิทธิวันลา</h1>
      <p className="text-slate-400 mb-4">กำหนดโควตาวันลาต่อปี และดูคงเหลือของพนักงานรายคน</p>
      <EntitlementsClient employees={JSON.parse(JSON.stringify(employees))} />
    </div>
  );
}
