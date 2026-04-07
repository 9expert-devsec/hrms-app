import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions"; // ต้องตั้ง alias ให้ใช้ได้ตามที่แก้ไป
import { redirect } from "next/navigation";
import { requireRolePage } from "@/lib/authz";
import AdminRegisterForm from "./AdminRegisterForm";

export default async function AdminRegisterPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user?.role !== "superadmin") redirect("/403"); // Admin only
  
  await requireRolePage(["superadmin"]); // ไม่มีสิทธิ์ → redirect /403
  return <AdminRegisterForm />;
}
