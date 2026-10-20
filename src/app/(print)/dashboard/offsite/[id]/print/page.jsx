// Printable off-site form. Lives in the (print) route group so the app's
// sidebar / topbar (the (protected) layout) are not rendered at all; the
// middleware still guards /dashboard/* (this path: offsite_self OR offsite_hr,
// lib/rbac/access.js canAccessPath).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAnyPage } from "@/lib/rbac/guard";
import { OFFSITE_PRINT_PAGES } from "@/lib/rbac/access";
import dbConnect from "@/lib/mongoose";
import { getPrintable, OffsiteError } from "@/lib/offsite";
import { formatDateLongTh } from "@/lib/offsiteRules";
import OffsitePrintForm, { PRINT_CSS } from "../../../../../../components/offsite/OffsitePrintForm";
import PrintButton from "../../../../../../components/offsite/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "แบบฟอร์มการเบิกเบี้ยเลี้ยงการทำงานนอกสถานที่" };

export default async function OffsitePrintPage({ params }) {
  const session = await requireAnyPage(OFFSITE_PRINT_PAGES);
  const { id } = await params;
  await dbConnect();

  let r;
  try {
    r = await getPrintable(session, id);
  } catch (e) {
    if (e instanceof OffsiteError && e.status === 404) notFound();
    if (e instanceof OffsiteError && e.status === 403) redirect("/403");
    throw e;
  }
  const now = new Date();
  const printedAt = `${formatDateLongTh(now)} ${now.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })} น.`;

  return (
    <div className="os-page">
      <style>{PRINT_CSS}</style>
      <div className="os-toolbar no-print">
        <Link href={`/dashboard/offsite/${r._id}`} style={{ color: "#5E6A7E" }}>
          ← กลับไปหน้าคำขอ
        </Link>
        <PrintButton />
      </div>
      <OffsitePrintForm r={r} printedAt={printedAt} />
    </div>
  );
}
