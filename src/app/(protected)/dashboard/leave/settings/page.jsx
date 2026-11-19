// /dashboard/leave/settings — ตั้งค่าการลา (leave_settings: hr and the superadmin).
// Leave types, per-employee approvers, quotas, fiscal year, HR signers and
// holidays — the data the leave flow is built on.
import { requirePage } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import {
  currentFiscalYear,
  getLeaveSettings,
  listEntitlements,
  listLeaveEmployees,
  listLeaveTypes,
  serializeSettings,
} from "@/lib/leaveSettings";
import { listHolidaysBetween } from "@/lib/leave/requests";
import { todayKey } from "@/lib/leave/countLeave";
import { PAGE, PAGE_BG } from "../../../../../components/hr/hrUi";
import LeaveSettingsClient from "./LeaveSettingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตั้งค่าการลา" };

export default async function LeaveSettingsPage({ searchParams }) {
  await requirePage("leave_settings");
  await dbConnect();
  const settings = await getLeaveSettings(); // seeds the singleton and system types if missing
  const fy = currentFiscalYear(settings);
  const holidayYear = Number(todayKey().slice(0, 4)); // Bangkok calendar year
  const [types, { employees, departments }, entitlements, holidays] = await Promise.all([
    listLeaveTypes(),
    listLeaveEmployees(),
    listEntitlements(fy),
    listHolidaysBetween(`${holidayYear}-01-01`, `${holidayYear}-12-31`),
  ]);
  const sp = await searchParams;

  return (
    <div className={PAGE} style={PAGE_BG}>
      <div className="mx-auto max-w-[1360px]">
        <LeaveSettingsClient
          initialTab={typeof sp?.tab === "string" ? sp.tab : "general"}
          settings={serializeSettings(settings)}
          types={types}
          employees={employees}
          departments={departments}
          currentFiscalYear={fy}
          entitlements={entitlements}
          holidayYear={holidayYear}
          holidays={holidays}
        />
      </div>
    </div>
  );
}
