import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/rbac/guard";
import { employeeOfUser } from "@/lib/rbac/scopeQueries";
import { getSignature } from "@/lib/offsite";
import dbConnect from "@/lib/mongoose";
import { UnlinkedNotice } from "../../../../../../components/SelfServiceGate";
import { SignatureManager } from "../../../../../../components/offsite/SignatureConfirm";

export const metadata = { title: "ลายเซ็นของฉัน" };

/** Own signature only (used to sign off-site requests). */
export default async function MySignaturePage() {
  const session = await requirePage("self_profile");
  await dbConnect();
  const emp = await employeeOfUser(session.user.id, "_id");
  if (!emp) return <UnlinkedNotice />;
  const sig = await getSignature(emp._id);

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-6 py-6">
      <Link href="/dashboard/hrm/employee-profile" className="touch-44 inline-flex items-center gap-1 text-sm" style={{ color: "#5E6A7E" }}>
        <ArrowLeft size={14} /> กลับไปโปรไฟล์
      </Link>
      <h1 style={{ color: "#0D1B2A", fontSize: "1.5rem", fontWeight: 600 }}>ลายเซ็นของฉัน</h1>
      <section
        className="rounded-2xl p-6"
        style={{ background: "#FFFFFF", border: "1px solid rgba(0,92,255,0.10)", boxShadow: "0 2px 8px rgba(13,27,42,0.06)" }}
      >
        <SignatureManager initialPng={sig?.png || null} />
      </section>
    </div>
  );
}
