// /dashboard/leave/request — ขอลา (paper form QF-HRD-001 REV.03).
// ?id=<leaveId>: the owner's returned leave, prefilled for ส่งใหม่.
import { requirePage } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import { buildRequestContext } from "@/lib/leave/requests";
import { LINE, NAVY, PAGE, PAGE_BG, SLATE } from "../../../../../components/hr/hrUi";
import LeaveRequestClient from "./LeaveRequestClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "ขอลา" };

export default async function LeaveRequestPage({ searchParams }) {
  const session = await requirePage("self_leave_request");
  await dbConnect();
  const sp = await searchParams;
  const ctx = await buildRequestContext(session, { leaveId: typeof sp?.id === "string" ? sp.id : null });

  return (
    <div className={PAGE} style={PAGE_BG}>
      <div className="mx-auto max-w-[1360px]">
        {ctx.linked ? (
          <LeaveRequestClient key={ctx.editing?._id || "new"} ctx={ctx} />
        ) : (
          <div className="rounded-[18px] bg-white p-6" style={{ border: `1px solid ${LINE}` }}>
            <h2 className="text-[17px] font-bold" style={{ color: NAVY }}>ยังขอลาไม่ได้</h2>
            <p className="mt-1 text-[14px]" style={{ color: SLATE }}>บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน — ติดต่อฝ่ายบุคคล</p>
          </div>
        )}
      </div>
    </div>
  );
}
