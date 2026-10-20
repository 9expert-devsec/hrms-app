import "server-only";
import Employee from "@/models/Employee";
import User from "@/models/User";
import { appUrl, runAfterResponse, sendMail } from "@/lib/mail/postmark";
import { buildOffsiteEmail } from "@/lib/mail/offsiteTemplates";
import { ACTIVE_APPROVAL_STATUSES } from "@/lib/offsiteRules";
import { employeeDisplayName, employeeFullNameTh } from "@/lib/employeeName";

/**
 * Off-site email notifications — the ONE place they are decided. lib/offsite.js
 * calls notifyTransitions(doc, newEvents, session) right after a successful
 * save; `newEvents` are the events that action appended. Emails go out after
 * the response (runAfterResponse), never to the person who acted, and a
 * failure is logged in EmailLog, never thrown.
 *
 *   invitations_sent          → members invited in this revision   (offsite_invite)
 *   members_ready             → leader (signs step 1) + creator, as information (offsite_members_ready)
 *   step2/3_pending           → that step's approver               (offsite_approval_pending)
 *   step2/3_reconfirm_pending → that step's approver               (offsite_reconfirm)
 *   returned                  → creator + leader                   (offsite_returned)
 *   approved                  → creator + leader                   (offsite_approved)
 *   cancelled                 → members still invited + the active step's approver (offsite_cancelled)
 */

const str = (v) => (v == null ? "" : String(v));

/** [{ type, employeeId }] for the given events, de-duplicated. */
export function planEmails(r, events) {
  const plan = [];
  const add = (type, employeeId) => {
    if (employeeId && !plan.some((p) => p.type === type && p.employeeId === str(employeeId))) plan.push({ type, employeeId: str(employeeId) });
  };
  const approverOf = (n) => (r.approvals || []).find((a) => a.step === n)?.approver;
  for (const e of events) {
    let m;
    if (e.type === "invitations_sent") {
      for (const mem of r.members) if (mem.status === "invited" && mem.invitedInRevision === r.revision) add("offsite_invite", mem.employee);
    } else if (e.type === "members_ready") {
      add("offsite_members_ready", r.leader);
      add("offsite_members_ready", r.createdBy);
    } else if ((m = e.type.match(/^step([23])_pending$/))) {
      add("offsite_approval_pending", approverOf(Number(m[1])));
    } else if ((m = e.type.match(/^step([23])_reconfirm_pending$/))) {
      add("offsite_reconfirm", approverOf(Number(m[1])));
    } else if (e.type === "returned") {
      add("offsite_returned", r.createdBy);
      add("offsite_returned", r.leader);
    } else if (e.type === "approved") {
      add("offsite_approved", r.createdBy);
      add("offsite_approved", r.leader);
    } else if (e.type === "cancelled") {
      for (const mem of r.members) if (mem.status === "invited") add("offsite_cancelled", mem.employee);
      for (const a of r.approvals || []) if (a.step >= 2 && ACTIVE_APPROVAL_STATUSES.includes(a.status)) add("offsite_cancelled", a.approver);
    }
  }
  return plan;
}

/** Login email of the linked User, else Employee.email, else null. */
async function recipientOf(employeeId) {
  const emp = await Employee.findById(employeeId).select("email userId firstName lastName titleTh firstNameTh lastNameTh").lean();
  if (!emp) return null;
  let address = "";
  if (emp.userId) address = (await User.findById(emp.userId).select("email").lean())?.email || "";
  return {
    userId: emp.userId ? str(emp.userId) : null,
    address: address || emp.email || "",
    name: employeeFullNameTh(emp) || employeeDisplayName(emp),
  };
}

async function deliver(r, plan, actorUserId, events) {
  const cancelReason = events.find((e) => e.type === "cancelled")?.detail || "";
  const url = appUrl(`/dashboard/offsite/${r._id}`);
  await Promise.all(
    plan.map(async ({ type, employeeId }) => {
      const who = await recipientOf(employeeId);
      if (who?.userId && who.userId === actorUserId) return; // never about their own action
      const { subject, html, text } = buildOffsiteEmail(type, {
        request: r,
        recipientName: who?.name || "",
        recipientIsCreator: employeeId === str(r.createdBy),
        recipientIsLeader: employeeId === str(r.leader),
        url,
        returnInfo: r.returnInfo,
        changeSummary: r.changeSummary,
        cancelReason,
      });
      await sendMail({ to: who?.address || "", subject, html, text, tag: type, metadata: { requestId: str(r._id), docNo: r.docNo || "" } });
    })
  );
}

/** Called by lib/offsite.js after a save; resolves quickly inside a request. */
export async function notifyTransitions(doc, events, session) {
  try {
    if (!events?.length) return;
    const r = doc.toObject ? doc.toObject() : doc;
    const plan = planEmails(r, events);
    if (!plan.length) return;
    const actorUserId = str(session?.user?.id);
    await runAfterResponse(() => deliver(r, plan, actorUserId, events));
  } catch (e) {
    console.error("[offsite] notify failed:", e?.message || e);
  }
}
