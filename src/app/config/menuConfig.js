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
//   /dashboard/exit/archive             /dashboard/settings/users
//   /dashboard/settings/workflows       /dashboard/settings/integrations
//   /dashboard/settings/policy-audit
import {
  LayoutDashboard,
  UserCircle2,
  CalendarCheck2,
  Clock4,
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
} from "lucide-react";

export const menuConfig = [
  {
    key: "main",
    type: "group",
    label: "MAIN",
    children: [
      {
        key: "dash",
        type: "link",
        label: "Dashboards",
        href: "/dashboard",
        icon: LayoutDashboard,
        pageKey: "dashboard",
      },

      {
        key: "emp",
        type: "group",
        label: "พนักงาน (Employee)",
        icon: Users,
        children: [
          {
            key: "emp-profile",
            type: "link",
            icon: UserCircle2,
            label: "โปรไฟล์ของฉัน",
            href: "/dashboard/hrm/employee-profile",
            pageKey: "self_profile",
          },
          {
            key: "emp-my-team",
            type: "link",
            icon: Users,
            label: "ทีมของฉัน",
            href: "/dashboard/hrm/employee-my-team",
            pageKey: "self_team",
          },
          // {
          //   key: "emp.leave.request",
          //   type: "link",
          //   icon: CalendarCheck2,
          //   label: "ขอ/ตรวจสอบการลา",
          //   href: "/dashboard/leave/request",
          // },
        ],
      },
      {
        key: "hr",
        type: "group",
        label: "HR / Admin",
        icon: ShieldCheck,
        children: [
          {
            key: "hr.employee.list",
            type: "link",
            icon: Users,
            label: "ข้อมูลพนักงาน",
            href: "/dashboard/hrm/employee",
            pageKey: "employees",
          },
          {
            key: "hr.orgchart",
            type: "link",
            icon: Network,
            label: "โครงสร้างองค์กร (Org Chart)",
            href: "/dashboard/hrm/orgchart",
            pageKey: "orgchart",
          },
        ],
      },
      {
        key: "time",
        type: "group",
        label: "เวลา & การทำงาน",
        icon: Clock4,
        children: [
          {
            key: "time.clock",
            type: "link",
            icon: Timer,
            label: "บันทึกเวลา",
            href: "/dashboard/attendance/clock",
            pageKey: "self_clock",
          },
          {
            key: "time.my-attendance",
            type: "link",
            icon: CalendarDays,
            label: "เวลาทำงานของฉัน",
            href: "/dashboard/attendance/my-attendance",
            pageKey: "self_attendance",
          },
          {
            key: "time.ot",
            type: "link",
            icon: Clock,
            label: "แจ้ง OT",
            href: "/dashboard/attendance/ot",
            pageKey: "self_ot",
          },
          {
            key: "time.ot-approve",
            type: "link",
            icon: CheckSquare,
            label: "อนุมัติ OT",
            href: "/dashboard/attendance/ot-approve",
            pageKey: "ot_approve",
          },
          {
            key: "time.shifts",
            type: "link",
            icon: AlarmClock,
            label: "รูปแบบเวลาทำงาน",
            href: "/dashboard/attendance/shifts",
            pageKey: "shifts",
          },
          {
            key: "time.assign-shift",
            type: "link",
            icon: UserCog,
            label: "กำหนดเวลาพนักงาน",
            href: "/dashboard/attendance/assign-shift",
            pageKey: "shift_assign",
          },
          {
            key: "time.report",
            type: "link",
            icon: BarChart2,
            label: "รายงานเวลาทำงาน",
            href: "/dashboard/attendance/report",
            pageKey: "attendance_report",
          },
          {
            key: "time.holidays",
            type: "link",
            icon: CalendarOff,
            label: "วันหยุด",
            href: "/dashboard/attendance/holidays",
            pageKey: "holidays",
          },
        ],
      },
      {
        key: "leave",
        type: "group",
        label: "การลา",
        icon: CalendarCheck2,
        children: [
          {
            key: "leave.request",
            type: "link",
            icon: FilePlus,
            label: "ขอลา",
            href: "/dashboard/leave/request",
            pageKey: "self_leave_request",
          },
          {
            key: "leave.history",
            type: "link",
            icon: ClipboardList,
            label: "ประวัติการลา",
            href: "/dashboard/leave/history",
            pageKey: "self_leave_history",
          },
          {
            key: "leave.balance",
            type: "link",
            icon: CalendarDays,
            label: "วันลาคงเหลือ",
            href: "/dashboard/leave/balance",
            pageKey: "self_leave_balance",
          },
          {
            // Also shown to department heads: canOpenPage applies
            // canOpenLeaveApproval to this key.
            key: "leave.approve",
            type: "link",
            icon: CheckSquare,
            label: "อนุมัติการลา",
            href: "/dashboard/leave/approve",
            pageKey: "leave_approve",
          },
          {
            key: "leave.calendar",
            type: "link",
            icon: CalendarRange,
            label: "ปฏิทินการลา",
            href: "/dashboard/leave/calendar",
            pageKey: "leave_calendar",
          },
          {
            key: "leave.document",
            type: "link",
            icon: FileText,
            label: "เอกสารการลา",
            href: "/dashboard/leave/document",
            pageKey: "self_leave_document",
          },
        ],
      },
      {
        key: "settings",
        type: "group",
        label: "การตั้งค่า (System Settings)",
        icon: UserCog,
        children: [
          {
            key: "settings.org",
            type: "link",
            icon: Building2,
            label: "แผนก/ตำแหน่ง",
            href: "/dashboard/hrm/departments",
            pageKey: "departments",
          },
          {
            key: "settings.hod",
            type: "link",
            icon: UserCog,
            label: "กำหนด HOD",
            href: "/dashboard/settings/department-head",
            pageKey: "hod_settings",
          },
          {
            key: "settings.users",
            type: "link",
            icon: Users,
            label: "ผู้ใช้",
            href: "/dashboard/settings/users",
            pageKey: "users_manage",
          },
          {
            // No registry key on purpose: pageKey null → canOpenPage allows
            // only the superadmin (same rule the middleware applies).
            key: "settings.roles",
            type: "link",
            icon: KeyRound,
            label: "บทบาทและสิทธิ์",
            href: "/dashboard/settings/roles",
            pageKey: null,
          },
        ],
      },

      // … กลุ่มอื่น ๆ ต่อได้
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
