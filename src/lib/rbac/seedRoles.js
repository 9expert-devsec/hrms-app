/**
 * The six HRMS roles as code constants. Used as the FALLBACK when the
 * `roles` collection has no document for a key (see resolveRole.js), so the
 * app behaves correctly before anything is seeded. The round-8 role editor
 * writes the first real Role documents.
 *
 * Page sets reproduce the access each role had before RBAC, minus the holes:
 *   - manager has no `scope_leave_all_depts`: a manager now approves the HOD
 *     step only for departments they head (previously, a manager with no
 *     department-head assignment saw every department's pending leave).
 *   - hr keeps `scope_ot_all` and the HR leave step, but not
 *     `scope_leave_all_depts` — HR acts on the HR step, not the HOD step.
 *   - `employees`, `orgchart` and `departments` are no longer reachable by URL
 *     for roles that never had them in the menu.
 */

/** Self-service keys (11) plus the dashboard — pre-ticked on every role. */
export const SELF = [
  "dashboard",
  "self_profile",
  "self_team",
  "self_clock",
  "self_attendance",
  "self_ot",
  "self_leave_request",
  "self_leave_history",
  "self_leave_balance",
  "leave_calendar",
  "self_leave_document",
  "offsite_self",
];

export const SEED_ROLES = [
  {
    key: "superadmin",
    name: "ผู้ดูแลระบบสูงสุด",
    color: "#dc2626",
    pages: [],
    isSystem: true,
    isSuperadmin: true,
  },
  {
    key: "hr",
    name: "ฝ่ายบุคคล",
    color: "#2486ff",
    pages: [
      ...SELF,
      "employees",
      "orgchart",
      "departments",
      "ot_approve",
      "shifts",
      "shift_assign",
      "holidays",
      "attendance_report",
      "leave_approve",
      "hod_settings",
      "scope_attendance_all",
      "scope_ot_all",
      "scope_leave_hr_step",
      "scope_leave_documents_all",
      "offsite_hr",
    ],
    isSystem: true,
    isSuperadmin: false,
  },
  {
    key: "manager",
    name: "ผู้จัดการ",
    color: "#7c3aed",
    pages: [
      ...SELF,
      "ot_approve",
      "attendance_report",
      "leave_approve",
      "scope_attendance_all",
      "scope_ot_all",
    ],
    isSystem: true,
    isSuperadmin: false,
  },
  { key: "it", name: "ฝ่ายไอที", color: "#0891b2", pages: [...SELF, "users_manage"], isSystem: true, isSuperadmin: false },
  { key: "payroll", name: "ฝ่ายเงินเดือน", color: "#d97706", pages: [...SELF], isSystem: true, isSuperadmin: false },
  { key: "employee", name: "พนักงาน", color: "#6b7280", pages: [...SELF], isSystem: true, isSuperadmin: false },
];

/** Least-privilege fallback for unknown role keys. */
export const FALLBACK_ROLE_KEY = "employee";
