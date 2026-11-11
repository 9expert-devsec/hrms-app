// src/app/(protected)/dashboard/hrm/employee/page.jsx
// ข้อมูลพนักงาน — every employee, grouped by department (lib/employeeDirectory.js).
import dbConnect from "@/lib/mongoose";
import { requirePage } from "@/lib/rbac/guard";
import { canAccess } from "@/lib/rbac/access";
import { loadEmployeeDirectory } from "@/lib/employeeDirectory";
import EmployeeDirectoryClient from "./EmployeeDirectoryClient";
import { PAGE, PAGE_BG } from "../../../../../components/hr/hrUi";

export const dynamic = "force-dynamic";

export default async function EmployeeIndexPage() {
  const session = await requirePage("employees");
  // The create and HR edit pages are guarded by the same key.
  const canManage = canAccess(session.user, "employees");

  await dbConnect();
  const dir = await loadEmployeeDirectory();

  // Only what the page shows goes to the browser (no account status detail).
  const groups = dir.groups.map((g) => ({
    key: g.key,
    code: g.code,
    name: g.name,
    color: g.color,
    rows: g.rows.map(({ accountStatus, titleTh, firstNameTh, lastNameTh, ...r }) => r),
  }));

  return (
    <div className={PAGE} style={PAGE_BG}>
      <div className="mx-auto max-w-[1360px]">
        <EmployeeDirectoryClient
          groups={groups}
          total={dir.total}
          departmentCount={dir.departmentCount}
          noAccountCount={dir.noAccountCount}
          canCreate={canManage}
          canEdit={canManage}
        />
      </div>
    </div>
  );
}
