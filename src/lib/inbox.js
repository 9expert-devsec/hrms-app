import "server-only";
import Leave from "@/models/Leave";
import OTRequest from "@/lib/models/OTRequest";
import { badgeCounts } from "@/lib/offsite";
import { canAccess, canOpenLeaveApproval } from "@/lib/rbac/access";
import { canActOnHrStep, hodStepScope } from "@/lib/rbac/leaveScope";
import { otScope } from "@/lib/rbac/scopes";
import { employeeIdsForScope } from "@/lib/rbac/scopeQueries";

/**
 * "รอคุณดำเนินการ" — everything waiting on the caller, in one place (the
 * top-bar bell, the dashboard card, the sidebar badges). Built from the SAME
 * rules the lists use, never a copy of them:
 *   - off-site invitations / approvals: lib/offsite.js badgeCounts (step 1
 *     for the leader, steps 2–3 for the approver, reconfirms included)
 *   - leave: the HOD step (hodStepScope — headed departments, or all with
 *     scope_leave_all_depts) and the HR step (scope_leave_hr_step), as
 *     GET /api/leave/pending lists them
 *   - OT: pending requests inside otScope, as GET /api/attendance/ot lists
 *     them for ot_approve holders
 * Only countDocuments on small, filtered sets. Only groups with something
 * waiting are returned, so a group the caller cannot act on never appears.
 * Callers must have called dbConnect() first.
 */

export const INBOX_GROUPS = {
  offsite_invites: { label: "คำเชิญทำงานนอกสถานที่", href: "/dashboard/offsite?tab=invites" },
  offsite_approvals: { label: "คำขอทำงานนอกสถานที่ที่รอคุณอนุมัติ / ยืนยันอีกครั้ง", href: "/dashboard/offsite?tab=approvals" },
  leave_approvals: { label: "การลาที่รอคุณอนุมัติ", href: "/dashboard/leave/approve" },
  ot_approvals: { label: "OT ที่รอคุณอนุมัติ", href: "/dashboard/attendance/ot-approve" },
};

/** Leaves waiting at a step the caller acts on (HOD step + HR step). */
async function leaveCount(user) {
  if (!canOpenLeaveApproval(user)) return 0;
  let n = 0;
  const hod = await hodStepScope(user);
  if (hod.all) n += await Leave.countDocuments({ status: "pending" });
  else if (hod.employeeIds.length) n += await Leave.countDocuments({ status: "pending", employeeId: { $in: hod.employeeIds } });
  if (canActOnHrStep(user)) n += await Leave.countDocuments({ status: "hod_approved" });
  return n;
}

/** Pending OT inside the caller's OT scope (ot_approve holders only). */
async function otCount(user) {
  if (!canAccess(user, "ot_approve")) return 0;
  const ids = await employeeIdsForScope(otScope(user)); // null = everyone
  if (ids === null) return OTRequest.countDocuments({ status: "pending" });
  return ids.length ? OTRequest.countDocuments({ status: "pending", employeeId: { $in: ids } }) : 0;
}

/** { total, items: [{ key, label, count, href }] } — only groups with count > 0. */
export async function inboxCounts(session) {
  const user = session?.user;
  const counts = {};
  if (canAccess(user, "offsite_self")) {
    const { invites, approvals } = await badgeCounts(session);
    counts.offsite_invites = invites;
    counts.offsite_approvals = approvals;
  }
  counts.leave_approvals = await leaveCount(user);
  counts.ot_approvals = await otCount(user);

  const items = Object.entries(INBOX_GROUPS)
    .map(([key, g]) => ({ key, label: g.label, href: g.href, count: counts[key] || 0 }))
    .filter((i) => i.count > 0);
  return { total: items.reduce((sum, i) => sum + i.count, 0), items };
}
