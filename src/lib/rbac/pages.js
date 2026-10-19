/**
 * HRMS page registry — the single source of truth for page-level RBAC.
 *
 * A page key is the unit of permission: a role either may open a page or
 * may not. The sidebar, the page guards, the middleware and the API guards
 * all read THIS list. Pure module: no server imports, safe on the Edge and
 * in the browser.
 *
 * KEYS ARE PERMANENT. They are stored on Role.pages documents in Mongo, so a
 * key is never renamed; rows may move between groups, labels may change.
 *
 * `match`:
 *   - 'exact'  → only the href itself.
 *   - 'prefix' → the href and its child routes. Segment-aware: '/x' matches
 *                '/x' and '/x/...', never '/x-y'. That is what keeps
 *                '/dashboard/attendance/ot' from swallowing '.../ot-approve'.
 *   - 'none'   → a SCOPE KEY. `href: null`; it widens what data a page or API
 *                returns and never resolves from a URL.
 *
 * Paths under /dashboard that resolve to no key are superadmin-only
 * (deny by default — see access.js).
 */
export const HRMS_PAGES = [
  {
    group: "ภาพรวม",
    pages: [
      { key: "dashboard", label: "แดชบอร์ด", href: "/dashboard", match: "exact" },
    ],
  },
  {
    group: "ของฉัน",
    pages: [
      { key: "self_profile", label: "โปรไฟล์ของฉัน", href: "/dashboard/hrm/employee-profile", match: "prefix" },
      { key: "self_team", label: "ทีมของฉัน", href: "/dashboard/hrm/employee-my-team", match: "prefix" },
      { key: "self_clock", label: "บันทึกเวลา", href: "/dashboard/attendance/clock", match: "prefix" },
      { key: "self_attendance", label: "เวลาทำงานของฉัน", href: "/dashboard/attendance/my-attendance", match: "prefix" },
      { key: "self_ot", label: "แจ้ง OT", href: "/dashboard/attendance/ot", match: "exact" },
      { key: "self_leave_request", label: "ขอลา", href: "/dashboard/leave/request", match: "prefix" },
      { key: "self_leave_history", label: "ประวัติการลา", href: "/dashboard/leave/history", match: "prefix" },
      { key: "self_leave_balance", label: "วันลาคงเหลือ", href: "/dashboard/leave/balance", match: "prefix" },
      { key: "leave_calendar", label: "ปฏิทินการลา", href: "/dashboard/leave/calendar", match: "prefix" },
      { key: "self_leave_document", label: "เอกสารการลา", href: "/dashboard/leave/document", match: "prefix" },
      { key: "offsite_self", label: "ทำงานนอกสถานที่", href: "/dashboard/offsite", match: "prefix" },
    ],
  },
  {
    group: "บุคลากร",
    pages: [
      { key: "employees", label: "ข้อมูลพนักงาน (ดู/เพิ่ม/แก้ไข)", href: "/dashboard/hrm/employee", match: "prefix" },
      { key: "orgchart", label: "โครงสร้างองค์กร", href: "/dashboard/hrm/orgchart", match: "prefix" },
      { key: "departments", label: "แผนก/ตำแหน่ง", href: "/dashboard/hrm/departments", match: "prefix" },
    ],
  },
  {
    group: "เวลาทำงาน",
    pages: [
      { key: "ot_approve", label: "อนุมัติ OT", href: "/dashboard/attendance/ot-approve", match: "prefix" },
      { key: "shifts", label: "รูปแบบเวลาทำงาน", href: "/dashboard/attendance/shifts", match: "prefix" },
      { key: "shift_assign", label: "กำหนดเวลาพนักงาน", href: "/dashboard/attendance/assign-shift", match: "prefix" },
      { key: "holidays", label: "วันหยุด", href: "/dashboard/attendance/holidays", match: "prefix" },
      { key: "attendance_report", label: "รายงานเวลาทำงาน", href: "/dashboard/attendance/report", match: "prefix" },
      // Read every off-site request (not drafts), print forms, see anyone's history.
      { key: "offsite_hr", label: "คำขอทำงานนอกสถานที่ทั้งหมด", href: "/dashboard/offsite/all", match: "prefix" },
      // Scope keys — widen data, never a route.
      { key: "scope_attendance_all", label: "ดูเวลาทำงานของพนักงานทุกคน", href: null, match: "none" },
      { key: "scope_ot_all", label: "อนุมัติ OT ได้ทุกแผนก", href: null, match: "none" },
    ],
  },
  {
    group: "การลา",
    pages: [
      { key: "leave_approve", label: "อนุมัติการลา", href: "/dashboard/leave/approve", match: "prefix" },
      // Scope keys — widen data, never a route.
      { key: "scope_leave_hr_step", label: "อนุมัติการลาขั้น HR (ขั้นสุดท้าย)", href: null, match: "none" },
      { key: "scope_leave_all_depts", label: "อนุมัติการลาขั้นหัวหน้าได้ทุกแผนก", href: null, match: "none" },
      { key: "scope_leave_documents_all", label: "ดูเอกสารการลาของทุกคน", href: null, match: "none" },
    ],
  },
  {
    group: "ตั้งค่าระบบ",
    pages: [
      { key: "hod_settings", label: "กำหนดหัวหน้าแผนก", href: "/dashboard/settings/department-head", match: "prefix" },
      // View the user list, issue temporary passwords, suspend / reactivate.
      // Changing roles stays superadmin-only.
      { key: "users_manage", label: "จัดการบัญชีผู้ใช้", href: "/dashboard/settings/users", match: "prefix" },
    ],
  },
];

const FLAT_PAGES = HRMS_PAGES.flatMap((g) => g.pages);

/** Every key, in registry order. */
export const ALL_PAGE_KEYS = FLAT_PAGES.map((p) => p.key);

/** For the round-8 role editor: [{ group, pages: [{ key, label, href }] }]. */
export const PAGE_GROUPS = HRMS_PAGES.map((g) => ({
  group: g.group,
  pages: g.pages.map(({ key, label, href }) => ({ key, label, href })),
}));

/** Registry row by key, or null. */
export function getPage(key) {
  return FLAT_PAGES.find((p) => p.key === key) ?? null;
}

function normalizePath(pathname) {
  if (typeof pathname !== "string" || pathname === "") return "";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

/**
 * Pathname → page key (longest matching href wins), or null when nothing
 * matches. Href-less scope rows are skipped explicitly.
 */
export function resolvePageKey(pathname) {
  const path = normalizePath(pathname);
  if (!path) return null;

  let best = null;
  for (const page of FLAT_PAGES) {
    const { href, match } = page;
    if (!href || match === "none") continue;
    const isMatch =
      match === "exact" ? path === href : path === href || path.startsWith(`${href}/`);
    if (isMatch && (!best || href.length > best.href.length)) best = page;
  }
  return best ? best.key : null;
}
