// src/app/config/menuConfig.js
//
// Every link carries the `pageKey` of src/lib/rbac/pages.js; the sidebar shows
// it when canOpenPage(session.user, pageKey) is true. Groups left with no
// visible children are hidden.
//
// Links whose page does not exist yet were removed (RBAC round 5). Restore
// each one, with a new registry key, when its page is built:
//   /dashboard/assets/my-devices        /dashboard/attendance/me
//   /dashboard/payroll/mypayslip        /dashboard/hr/recruit-onboard
//   /dashboard/hr/offboard              /dashboard/hr/policy
//   /dashboard/hr/reports               /dashboard/payroll/calc
//   /dashboard/payroll/slips            /dashboard/payroll/bonus
//   /dashboard/payroll/benefits         /dashboard/performance/kpi
//   /dashboard/performance/forms        /dashboard/performance/feedback360
//   /dashboard/performance/promotion    /dashboard/assets
//   /dashboard/assets/borrow            /dashboard/assets/maintenance
//   /dashboard/assets/audit             /dashboard/assets/reports
//   /dashboard/exit/interview           /dashboard/exit/checklist
//   /dashboard/exit/archive             /dashboard/settings/workflows
//   /dashboard/settings/integrations    /dashboard/settings/policy-audit
//
// Round 31: grouped by who uses it. Top level = the แดชบอร์ด link, then one
// section (`type: "group"`) per audience: ของฉัน, งานอนุมัติ, ฝ่ายบุคคล,
// เวลาทำงาน, ตั้งค่าระบบ. A section's `icon` is its button on the collapsed
// rail; `inDevelopment` puts the "กำลังพัฒนา" tag on its header and
// `defaultCollapsed` starts it closed. pageKeys, hrefs and badge keys did not
// change — RBAC is exactly what it was.
import {
  LayoutGrid,
  UserCircle2,
  User,
  Users,
  Network,
  ShieldCheck,
  ClipboardList,
  CalendarDays,
  UserCog,
  Building2,
  FileText,
  CalendarRange,
  FilePlus,
  CheckSquare,
  Timer,
  Clock,
  AlarmClock,
  BarChart2,
  CalendarOff,
  KeyRound,
  MapPin,
  FolderOpen,
  Mail,
} from "lucide-react";

const link = (key, label, href, icon, pageKey, extra = {}) => ({ key, type: "link", label, href, icon, pageKey, ...extra });

export const menuConfig = [
  // "/dashboard" is the parent of every route: active only on itself.
  link("dash", "แดชบอร์ด", "/dashboard", LayoutGrid, "dashboard", { exact: true }),
  {
    key: "me",
    type: "group",
    label: "ของฉัน",
    icon: User,
    children: [
      link("emp-profile", "โปรไฟล์ของฉัน", "/dashboard/hrm/employee-profile", UserCircle2, "self_profile"),
      link("emp-my-team", "ทีมของฉัน", "/dashboard/hrm/employee-my-team", Users, "self_team"),
      // Count from components/useMenuBadges.js (invitations + approvals waiting for me).
      link("time.offsite", "ทำงานนอกสถานที่", "/dashboard/offsite", MapPin, "offsite_self", { badgeKey: "offsite_invites" }),
      link("leave.request", "ขอลา", "/dashboard/leave/request", FilePlus, "self_leave_request"),
      link("leave.history", "ประวัติการลา", "/dashboard/leave/history", ClipboardList, "self_leave_history"),
      link("leave.balance", "วันลาคงเหลือ", "/dashboard/leave/balance", CalendarDays, "self_leave_balance"),
      link("leave.document", "เอกสารการลา", "/dashboard/leave/document", FileText, "self_leave_document"),
    ],
  },
  {
    key: "approvals",
    type: "group",
    label: "งานอนุมัติ",
    icon: CheckSquare,
    children: [
      // Also shown to department heads: canOpenPage applies
      // canOpenLeaveApproval to this key.
      link("leave.approve", "อนุมัติการลา", "/dashboard/leave/approve", CheckSquare, "leave_approve"),
    ],
  },
  {
    key: "hr",
    type: "group",
    label: "ฝ่ายบุคคล",
    icon: ShieldCheck,
    children: [
      link("hr.employee.list", "ข้อมูลพนักงาน", "/dashboard/hrm/employee", Users, "employees"),
      link("hr.orgchart", "โครงสร้างองค์กร", "/dashboard/hrm/orgchart", Network, "orgchart"),
      link("time.offsite-all", "คำขอทำงานนอกสถานที่ทั้งหมด", "/dashboard/offsite/all", FolderOpen, "offsite_hr"),
      link("time.email-log", "บันทึกการส่งอีเมล", "/dashboard/offsite/all/email-log", Mail, "offsite_hr"),
      link("leave.calendar", "ปฏิทินการลา", "/dashboard/leave/calendar", CalendarRange, "leave_calendar"),
    ],
  },
  {
    // Every key here is `inDevelopment` in the registry: only the superadmin sees it.
    key: "time",
    type: "group",
    label: "เวลาทำงาน",
    icon: Timer,
    inDevelopment: true,
    defaultCollapsed: true,
    children: [
      link("time.clock", "บันทึกเวลา", "/dashboard/attendance/clock", Timer, "self_clock"),
      link("time.my-attendance", "เวลาทำงานของฉัน", "/dashboard/attendance/my-attendance", CalendarDays, "self_attendance"),
      link("time.ot", "แจ้ง OT", "/dashboard/attendance/ot", Clock, "self_ot"),
      link("time.ot-approve", "อนุมัติ OT", "/dashboard/attendance/ot-approve", CheckSquare, "ot_approve"),
      link("time.shifts", "รูปแบบเวลาทำงาน", "/dashboard/attendance/shifts", AlarmClock, "shifts"),
      link("time.assign-shift", "กำหนดเวลาพนักงาน", "/dashboard/attendance/assign-shift", UserCog, "shift_assign"),
      link("time.report", "รายงานเวลาทำงาน", "/dashboard/attendance/report", BarChart2, "attendance_report"),
      link("time.holidays", "วันหยุด", "/dashboard/attendance/holidays", CalendarOff, "holidays"),
    ],
  },
  {
    key: "settings",
    type: "group",
    label: "ตั้งค่าระบบ",
    icon: UserCog,
    children: [
      link("settings.org", "แผนกและตำแหน่ง", "/dashboard/hrm/departments", Building2, "departments"),
      link("settings.hod", "กำหนดหัวหน้าแผนก", "/dashboard/settings/department-head", UserCog, "hod_settings"),
      link("settings.users", "ผู้ใช้", "/dashboard/settings/users", Users, "users_manage"),
      // No registry key on purpose: pageKey null → canOpenPage allows
      // only the superadmin (same rule the middleware applies).
      link("settings.roles", "บทบาทและสิทธิ์", "/dashboard/settings/roles", KeyRound, null),
    ],
  },
];

/**
 * The menu as `user` may see it: links filtered by `isAllowed(user, pageKey)`
 * (pass canOpenPage), groups with no remaining children dropped.
 */
export function filterMenu(nodes, user, isAllowed) {
  return nodes.flatMap((node) => {
    if (node.type === "group") {
      const children = filterMenu(node.children ?? [], user, isAllowed);
      return children.length ? [{ ...node, children }] : [];
    }
    return isAllowed(user, node.pageKey) ? [node] : [];
  });
}

/** Every link of a (filtered) menu, each with its section (null at top level). */
export function flattenMenu(nodes, section = null) {
  return nodes.flatMap((node) =>
    node.type === "group" ? flattenMenu(node.children ?? [], node) : [{ link: node, section }]
  );
}

/**
 * The link `pathname` belongs to: the link whose href is the path itself or
 * its closest ancestor (segment-aware, longest href wins; `exact` links match
 * only themselves). `{ link, section }`, or null when nothing matches.
 */
export function findActiveLink(nodes, pathname) {
  if (!pathname) return null;
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  let best = null;
  for (const entry of flattenMenu(nodes)) {
    const { href, exact } = entry.link;
    if (!href) continue;
    const hit = path === href || (!exact && path.startsWith(`${href}/`));
    if (hit && (!best || href.length > best.link.href.length)) best = entry;
  }
  return best;
}
