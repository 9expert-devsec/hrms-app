import "server-only";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import OffsiteRequest from "@/models/OffsiteRequest";
import { canAccess } from "@/lib/rbac/access";
import { employeeOfUser } from "@/lib/rbac/scopeQueries";
import { inboxCounts } from "@/lib/inbox";
import { EMPLOYEE_NAME_FIELDS, employeeDisplayName, employeeFullNameTh } from "@/lib/employeeName";
import { STATUS_LABELS, THAI_MONTHS, progressCaption, progressOf } from "@/lib/offsiteRules";
import { normalizePhotoCrop } from "@/lib/photoCrop";

/**
 * Everything the dashboard shows, from real data only. Each block is null
 * when the caller may not open the page it summarises, and each query is
 * scoped like that page:
 *   - stats: /dashboard/hrm/employee (every Employee), /dashboard/hrm/departments
 *     (departments with ≥ 1 employee, matched by departmentId, else by code),
 *     /dashboard/offsite/all (not drafts; cancelled left out here too);
 *   - off-site: the caller's own requests, as a member or as the creator.
 * Dates: workDate and dateOfJoin are stored as UTC-midnight calendar dates,
 * so "this month" / "today" are the Asia/Bangkok calendar date as UTC midnight.
 * Callers must have called dbConnect() first.
 */

const LIVE = { $nin: ["draft", "cancelled"] };
const IN_PROGRESS = ["inviting", "members_ready", "in_approval", "returned"];
const WEEKDAYS_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
export const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const PROFILE_FIELDS = `_id ${EMPLOYEE_NAME_FIELDS} photoUrl photoCrop department departmentId position`;

/** Bangkok calendar today → { today, monthStart, monthEnd } (UTC-midnight Dates) and the Thai long date. */
export function bangkokToday(now = new Date()) {
  const [y, m, d] = now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).split("-").map(Number);
  const today = new Date(Date.UTC(y, m - 1, d));
  return {
    today,
    monthStart: new Date(Date.UTC(y, m - 1, 1)),
    monthEnd: new Date(Date.UTC(y, m, 1)),
    longTh: `วัน${WEEKDAYS_TH[today.getUTCDay()]}ที่ ${d} ${THAI_MONTHS[m - 1]} ${y + 543}`,
  };
}

/** UTC-midnight date → "3 พ.ย. 2569". */
export function shortDateTh(value) {
  const d = value ? new Date(value) : null;
  if (!d || isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${THAI_MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
}

const nameOf = (emp) => employeeFullNameTh(emp) || employeeDisplayName(emp);

async function departmentOf(emp) {
  if (!emp) return null;
  const select = "name code headOfDepartment";
  if (emp.departmentId) return Department.findById(emp.departmentId).select(select).lean();
  return emp.department ? Department.findOne({ code: emp.department }).select(select).lean() : null;
}

/** Departments with at least one employee — the rule of the departments page's count column. */
async function departmentsWithEmployees() {
  const [departments, byId, byCode] = await Promise.all([
    Department.find({}).select("_id code").lean(),
    Employee.distinct("departmentId", { departmentId: { $ne: null } }),
    Employee.distinct("department", { departmentId: null, department: { $type: "string", $ne: "" } }),
  ]);
  const ids = new Set(byId.map(String));
  const codes = new Set(byCode);
  return departments.filter((d) => ids.has(String(d._id)) || codes.has(d.code)).length;
}

async function stats(user, range) {
  const canEmployees = canAccess(user, "employees");
  const canDepartments = canAccess(user, "departments");
  const canOffsiteHr = canAccess(user, "offsite_hr");
  if (!canEmployees && !canDepartments && !canOffsiteHr) return null;
  const inMonth = { $gte: range.monthStart, $lt: range.monthEnd };
  const [employees, newCount, newest, departments, offsiteTotal, offsiteApproved] = await Promise.all([
    canEmployees ? Employee.countDocuments({}) : null,
    canEmployees ? Employee.countDocuments({ dateOfJoin: inMonth }) : null,
    canEmployees ? Employee.findOne({ dateOfJoin: inMonth }).sort({ dateOfJoin: -1 }).select("dateOfJoin").lean() : null,
    canDepartments ? departmentsWithEmployees() : null,
    canOffsiteHr ? OffsiteRequest.countDocuments({ workDate: inMonth, status: LIVE }) : null,
    canOffsiteHr ? OffsiteRequest.countDocuments({ workDate: inMonth, status: "approved" }) : null,
  ]);
  return {
    employees: canEmployees ? { value: employees } : null,
    departments: canDepartments ? { value: departments } : null,
    newThisMonth: canEmployees ? { value: newCount, latest: newest ? shortDateTh(newest.dateOfJoin) : null } : null,
    offsiteThisMonth: canOffsiteHr ? { value: offsiteTotal, approved: offsiteApproved, inProgress: offsiteTotal - offsiteApproved } : null,
  };
}

async function upcomingFor(me, range) {
  const docs = await OffsiteRequest.find({ "members.employee": me, workDate: { $gte: range.today }, status: LIVE })
    .select("jobName workDate startTime endTime placeName members.employee leader status")
    .sort({ workDate: 1, startTime: 1, createdAt: 1 })
    .limit(5)
    .lean();
  return docs.map((d) => {
    const w = new Date(d.workDate);
    return {
      id: String(d._id),
      jobName: d.jobName,
      day: w.getUTCDate(),
      month: THAI_MONTHS_SHORT[w.getUTCMonth()],
      placeName: d.placeName,
      time: d.startTime && d.endTime ? `${d.startTime}–${d.endTime} น.` : "",
      memberCount: (d.members || []).length,
      isLeader: String(d.leader) === String(me),
      status: d.status,
      statusLabel: STATUS_LABELS[d.status] || d.status,
    };
  });
}

async function myRequestsFor(me) {
  const docs = await OffsiteRequest.find({ createdBy: me, status: { $in: IN_PROGRESS } })
    .select("jobName docNo status approvals members.status createdAt")
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();
  return docs.map((d) => ({ id: String(d._id), jobName: d.jobName, docNo: d.docNo || null, progress: progressOf(d), caption: progressCaption(d) }));
}

export async function dashboardData(session) {
  const user = session.user;
  const range = bangkokToday();
  const canOffsite = canAccess(user, "offsite_self");

  const [emp, inbox] = await Promise.all([employeeOfUser(user.id, PROFILE_FIELDS), inboxCounts(session)]);
  const me = emp?._id;

  const [dept, monthMine, upcoming, myRequests, statBlock] = await Promise.all([
    departmentOf(emp),
    canOffsite && me ? OffsiteRequest.countDocuments({ "members.employee": me, workDate: { $gte: range.monthStart, $lt: range.monthEnd }, status: LIVE }) : null,
    canOffsite && me ? upcomingFor(me, range) : null,
    canOffsite && me ? myRequestsFor(me) : null,
    stats(user, range),
  ]);
  const head = dept?.headOfDepartment ? await Employee.findById(dept.headOfDepartment).select(EMPLOYEE_NAME_FIELDS).lean() : null;

  const departmentName = dept?.name || emp?.department || "";
  return {
    dateTh: range.longTh,
    firstName: (emp?.firstNameTh || "").trim() || (emp?.firstName || "").trim() || (user.name || "").split(" ")[0] || "",
    chip: emp ? [departmentName, emp.position].filter(Boolean).join(" · ") : "",
    inbox,
    monthMine,
    stats: statBlock,
    upcoming,
    myRequests,
    profile: emp
      ? {
          name: nameOf(emp),
          nickName: (emp.nickName || "").trim(),
          photoUrl: emp.photoUrl || null,
          photoCrop: normalizePhotoCrop(emp.photoCrop),
          initialsFrom: employeeDisplayName(emp),
          department: departmentName,
          position: emp.position || "",
          head: head ? nameOf(head) : "",
        }
      : null,
    linked: !!emp,
  };
}
