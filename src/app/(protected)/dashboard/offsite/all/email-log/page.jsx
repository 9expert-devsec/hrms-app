// Under /dashboard/offsite/all, so the path resolves to offsite_hr
// (superadmin passes too); the API narrows non-superadmins to off-site types.
import { requirePage } from "@/lib/rbac/guard";
import EmailLogList from "../../../../../../components/offsite/EmailLogList";

export const metadata = { title: "บันทึกการส่งอีเมล" };

export default async function EmailLogPage() {
  await requirePage("offsite_hr");
  return (
    <div className="container mx-auto px-6 py-6">
      <EmailLogList />
    </div>
  );
}
