import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/rbac/guard";
import { OffsiteEditLoader } from "../../../../../../components/offsite/OffsiteForm";

export const metadata = { title: "แก้ไขคำขอทำงานนอกสถานที่" };

export default async function EditOffsitePage({ params }) {
  await requirePage("offsite_self");
  const { id } = await params;
  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-6 py-6">
      <Link href={`/dashboard/offsite/${id}`} className="inline-flex items-center gap-1 text-sm" style={{ color: "#5E6A7E" }}>
        <ArrowLeft size={14} /> กลับ
      </Link>
      <h1 style={{ color: "#0D1B2A", fontSize: "1.5rem", fontWeight: 600 }}>แก้ไขคำขอทำงานนอกสถานที่</h1>
      <OffsiteEditLoader id={id} />
    </div>
  );
}
