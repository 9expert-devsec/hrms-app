// /dashboard/leave/approve — อนุมัติการลา (round 41): approver (1)/(2) approve
// or return, the other one acknowledges, an HR signer signs the HR step.
// ?tab=approve|acknowledge|hr|done&id=<leaveId> opens a tab / one leave.
// Opening the page: canOpenLeaveApproval (leave_approve, a department head,
// or someone the leave flow names); every list and action is decided by the
// leave itself (lib/leave/approval.js).
import { requirePage } from "@/lib/rbac/guard";
import { PAGE, PAGE_BG } from "../../../../../components/hr/hrUi";
import ApproveClient from "./ApproveClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "อนุมัติการลา" };

export default async function LeaveApprovePage({ searchParams }) {
  await requirePage("leave_approve");
  const sp = await searchParams;
  const tab = typeof sp?.tab === "string" ? sp.tab : null;
  const id = typeof sp?.id === "string" ? sp.id : null;
  return (
    <div className={PAGE} style={PAGE_BG}>
      <div className="mx-auto max-w-[1360px]">
        <ApproveClient initialTab={tab} initialId={id} />
      </div>
    </div>
  );
}
