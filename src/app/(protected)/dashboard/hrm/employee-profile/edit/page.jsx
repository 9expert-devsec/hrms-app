import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/rbac/guard";
import { employeeOfUser } from "@/lib/rbac/scopeQueries";
import dbConnect from "@/lib/mongoose";
import { employeeFullNameTh, employeeDisplayName } from "@/lib/employeeName";
import { UnlinkedNotice } from "../../../../../../components/SelfServiceGate";
import SelfProfileForm from "./SelfProfileForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "แก้ไขโปรไฟล์ของฉัน" };

/** Own record only: photo, nickname, phone (PATCH /api/employees/me). */
export default async function EditMyProfilePage() {
  const session = await requirePage("self_profile");
  await dbConnect();
  const emp = await employeeOfUser(
    session.user.id,
    "_id photoUrl nickName phone titleTh firstNameTh lastNameTh firstName lastName"
  );
  if (!emp) return <UnlinkedNotice />;

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-6 py-6">
      <Link href="/dashboard/hrm/employee-profile" className="inline-flex items-center gap-1 text-sm" style={{ color: "#5E6A7E" }}>
        <ArrowLeft size={14} /> กลับไปโปรไฟล์
      </Link>
      <div>
        <h1 style={{ color: "#0D1B2A", fontSize: "1.5rem", fontWeight: 600 }}>แก้ไขโปรไฟล์ของฉัน</h1>
        <p style={{ color: "#5E6A7E", fontSize: 14 }}>{employeeFullNameTh(emp) || employeeDisplayName(emp)}</p>
      </div>
      <SelfProfileForm initial={{ photoUrl: emp.photoUrl || "", nickName: emp.nickName || "", phone: emp.phone || "" }} />
    </div>
  );
}
