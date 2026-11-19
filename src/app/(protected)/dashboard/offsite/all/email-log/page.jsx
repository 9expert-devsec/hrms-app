// บันทึกการส่งอีเมล. Opened by offsite_hr, leave_settings or an HR signer
// (lib/rbac/access.js canOpenEmailLog — the middleware uses the same rule for
// this path); the API narrows the rows to the types each may see.
import { redirect } from "next/navigation";
import { requireAnyPage } from "@/lib/rbac/guard";
import { canOpenEmailLog } from "@/lib/rbac/access";
import EmailLogList from "../../../../../../components/offsite/EmailLogList";

export const metadata = { title: "บันทึกการส่งอีเมล" };

export default async function EmailLogPage() {
  const session = await requireAnyPage(["dashboard", "offsite_hr", "leave_settings"]);
  if (!canOpenEmailLog(session.user)) redirect("/403");
  return (
    <div className="container mx-auto px-6 py-6">
      <EmailLogList />
    </div>
  );
}
