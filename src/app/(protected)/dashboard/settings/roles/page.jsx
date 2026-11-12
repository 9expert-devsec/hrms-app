// /dashboard/settings/roles — บทบาทและสิทธิ์ (superadmin only).
// Deliberately NOT in the page registry: unregistered /dashboard paths are
// superadmin-only in the middleware, and requireSuperadminPage re-checks here.
import dbConnect from "@/lib/mongoose";
import { requireSuperadminPage } from "@/lib/rbac/guard";
import { listRoles } from "@/lib/rbac/roles";
import { HRMS_PAGES } from "@/lib/rbac/pages";
import User from "@/models/User";
import Employee from "@/models/Employee";
import { EMPLOYEE_NAME_FIELDS, employeeDisplayName } from "@/lib/employeeName";
import { normalizePhotoCrop } from "@/lib/photoCrop";
import RolesClient from "./RolesClient";

export const dynamic = "force-dynamic";

const AVATARS_PER_ROLE = 4;

export default async function RolesPage() {
  await requireSuperadminPage();
  await dbConnect();
  const [roles, users] = await Promise.all([listRoles(), User.find({}).select("_id name email role").sort({ email: 1 }).lean()]);

  // Up to 4 holders per role for the card's avatar stack (linked employee's photo / name).
  const emps = await Employee.find({ userId: { $in: users.map((u) => u._id) } }).select(`userId photoUrl photoCrop ${EMPLOYEE_NAME_FIELDS}`).lean();
  const empByUser = new Map(emps.map((e) => [String(e.userId), e]));
  const holders = {};
  for (const u of users) {
    const list = (holders[u.role] ||= []);
    if (list.length >= AVATARS_PER_ROLE) continue;
    const e = empByUser.get(String(u._id));
    list.push({ id: String(u._id), name: (e && employeeDisplayName(e)) || u.name || u.email, photoUrl: e?.photoUrl || null, photoCrop: e?.photoUrl ? normalizePhotoCrop(e.photoCrop) : null });
  }

  // Checklist groups, with scope keys (match "none") and in-development rows flagged.
  const groups = HRMS_PAGES.map((g) => ({
    group: g.group,
    pages: g.pages.map((p) => ({ key: p.key, label: p.label, scope: p.match === "none", inDevelopment: p.inDevelopment === true })),
  }));

  return <RolesClient initialRoles={JSON.parse(JSON.stringify(roles))} groups={groups} holders={holders} />;
}
