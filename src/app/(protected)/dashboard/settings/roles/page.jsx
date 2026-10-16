// /dashboard/settings/roles — บทบาทและสิทธิ์ (superadmin only).
// Deliberately NOT in the page registry: unregistered /dashboard paths are
// superadmin-only in the middleware, and requireSuperadminPage re-checks here.
import dbConnect from "@/lib/mongoose";
import { requireSuperadminPage } from "@/lib/rbac/guard";
import { listRoles } from "@/lib/rbac/roles";
import { HRMS_PAGES } from "@/lib/rbac/pages";
import RolesClient from "./RolesClient";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  await requireSuperadminPage();
  await dbConnect();
  const roles = await listRoles();

  // Checklist groups, with scope keys (match "none") flagged.
  const groups = HRMS_PAGES.map((g) => ({
    group: g.group,
    pages: g.pages.map((p) => ({ key: p.key, label: p.label, scope: p.match === "none" })),
  }));

  return <RolesClient initialRoles={JSON.parse(JSON.stringify(roles))} groups={groups} />;
}
