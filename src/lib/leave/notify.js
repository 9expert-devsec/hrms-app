import "server-only";
import Employee from "@/models/Employee";
import User from "@/models/User";
import LeaveSettings from "@/models/LeaveSettings";
import { appUrl, runAfterResponse, sendMail } from "@/lib/mail/postmark";
import { buildLeaveEmail } from "@/lib/mail/leaveTemplates";
import { HOURS_PER_DAY } from "@/lib/leave/countLeave";
import { employeeDisplayName, employeeFullNameTh } from "@/lib/employeeName";

/**
 * Leave email notifications — the ONE place they are decided (same pattern
 * as lib/offsiteNotify.js). Called right after a successful save with the
 * event that action produced. Emails go out after the response, never to
 * the person who acted, and a failure is logged in EmailLog, never thrown.
 *
 *   submitted (also resubmitted) → approver (1) + (2)       (leave_approval_pending)
 *                                  auto-approve: HR signers (leave_hr_pending)
 *   step1_approved               → HR signers                (leave_hr_pending)
 *                                  + the acknowledger        (leave_ack_pending)
 *   returned (either step)       → requester                 (leave_returned)
 *   hr_approved                  → requester                 (leave_approved)
 *   cancel_requested             → HR signers                (leave_cancel_pending)
 *   cancel_approved              → requester                 (leave_cancel_approved)
 *                                  + the step-1 decider, FYI (leave_cancel_fyi)
 *   cancel_rejected              → requester, with the note  (leave_cancel_rejected)
 */

const str = (v) => (v == null ? "" : String(v));

/** [{ type, employeeId }] for one event, de-duplicated. */
export function planLeaveEmails(leave, event, hrSignerIds = []) {
  const plan = [];
  const add = (type, employeeId) => {
    if (employeeId && !plan.some((p) => p.type === type && p.employeeId === str(employeeId))) plan.push({ type, employeeId: str(employeeId) });
  };
  if (event === "submitted") {
    if (leave.status === "pending_hr") for (const id of hrSignerIds) add("leave_hr_pending", id);
    else {
      add("leave_approval_pending", leave.approver1Id);
      add("leave_approval_pending", leave.approver2Id);
    }
  } else if (event === "step1_approved") {
    for (const id of hrSignerIds) add("leave_hr_pending", id);
    add("leave_ack_pending", leave.step1Ack?.expectedBy);
  } else if (event === "returned") {
    add("leave_returned", leave.employeeId);
  } else if (event === "hr_approved") {
    add("leave_approved", leave.employeeId);
  } else if (event === "cancel_requested") {
    for (const id of hrSignerIds) add("leave_cancel_pending", id);
  } else if (event === "cancel_approved") {
    add("leave_cancel_approved", leave.employeeId);
    // FYI to the step-1 decider (none for an auto-approved step 1).
    if (!leave.step1?.auto && str(leave.step1?.employeeId) !== str(leave.employeeId)) add("leave_cancel_fyi", leave.step1?.employeeId);
  } else if (event === "cancel_rejected") {
    add("leave_cancel_rejected", leave.employeeId);
  }
  return plan;
}

const NAME_FIELDS = "email userId firstName lastName titleTh firstNameTh lastNameTh nickName";
const nameOf = (emp) => (emp ? employeeFullNameTh(emp) || employeeDisplayName(emp) || "" : "");

/** Login email of the linked User, else Employee.email. */
async function recipientOf(employeeId) {
  const emp = await Employee.findById(employeeId).select(NAME_FIELDS).lean();
  if (!emp) return null;
  let address = "";
  if (emp.userId) address = (await User.findById(emp.userId).select("email").lean())?.email || "";
  return { userId: emp.userId ? str(emp.userId) : null, address: address || emp.email || "", name: nameOf(emp) };
}

const URL_OF = {
  leave_approval_pending: (l) => `/dashboard/leave/approve?tab=approve&id=${l._id}`,
  leave_hr_pending: (l) => `/dashboard/leave/approve?tab=hr&id=${l._id}`,
  leave_ack_pending: (l) => `/dashboard/leave/approve?tab=acknowledge&id=${l._id}`,
  leave_returned: (l) => `/dashboard/leave/request?id=${l._id}`,
  leave_approved: () => "/dashboard/leave/history",
  leave_cancel_pending: (l) => `/dashboard/leave/approve?tab=cancel&id=${l._id}`,
  leave_cancel_approved: (l) => `/dashboard/leave/document?id=${l._id}`,
  leave_cancel_fyi: (l) => `/dashboard/leave/document?id=${l._id}`,
  leave_cancel_rejected: (l) => `/dashboard/leave/document?id=${l._id}`,
};

async function deliver(leave, plan, actorUserId, settings) {
  const requester = await Employee.findById(leave.employeeId).select(NAME_FIELDS).lean();
  const ctx = {
    leave,
    requesterName: nameOf(requester) || "-",
    approverName: leave.step1?.name || "",
    returnInfo: leave.returnInfo,
    hoursPerDay: Number(settings?.hoursPerDay) > 0 ? Number(settings.hoursPerDay) : HOURS_PER_DAY,
  };
  await Promise.all(
    plan.map(async ({ type, employeeId }) => {
      const who = await recipientOf(employeeId);
      if (who?.userId && who.userId === actorUserId) return; // never about their own action
      const { subject, html, text } = buildLeaveEmail(type, { ...ctx, recipientName: who?.name || "", url: appUrl(URL_OF[type](leave)) });
      await sendMail({ to: who?.address || "", subject, html, text, tag: type, metadata: { requestId: str(leave._id), docNo: "" } });
    })
  );
}

/**
 * Called after a leave action is saved. `event`: submitted | step1_approved |
 * returned | hr_approved | cancel_requested | cancel_approved |
 * cancel_rejected. Resolves quickly inside a request.
 */
export async function notifyLeave(doc, event, session) {
  try {
    const leave = doc?.toObject ? doc.toObject() : doc;
    if (!leave) return;
    const settings = await LeaveSettings.findOne({ key: "default" }).select("hrSigners hoursPerDay").lean();
    const plan = planLeaveEmails(leave, event, (settings?.hrSigners || []).map(str));
    if (!plan.length) return;
    const actorUserId = str(session?.user?.id);
    await runAfterResponse(() => deliver(leave, plan, actorUserId, settings));
  } catch (e) {
    console.error("[leave] notify failed:", e?.message || e);
  }
}
