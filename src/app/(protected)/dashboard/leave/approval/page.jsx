export const dynamic = "force-dynamic";

import { requireSessionPage } from "@/lib/authz";
import ApprovalClient from "./ApprovalClient";

export default async function LeaveApprovalPage() {
  // ต้องล็อกอินก่อน
  await requireSessionPage();

  return (
    <div className="px-6 py-6">
      <h1 className="text-2xl font-semibold text-slate-100 mb-2">
        Leave Approval
      </h1>
      <p className="text-slate-400 mb-4">
        อนุมัติ/ปฏิเสธคำขอลา — เปิดเอกสาร, ดาวน์โหลด PDF ได้
      </p>

      <ApprovalClient />
    </div>
  );
}
