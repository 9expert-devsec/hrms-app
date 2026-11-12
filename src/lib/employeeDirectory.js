import "server-only";
import Employee from "@/models/Employee";
import Department from "@/models/Department";
import User from "@/models/User";
import { employeeDisplayName, employeeFullNameTh, employeeNameEn } from "@/lib/employeeName";
import { NO_DEPARTMENT, NO_DEPARTMENT_LABEL, rowSearchText } from "@/lib/employeeDirectoryFilter";
import { normalizePhotoCrop } from "@/lib/photoCrop";

/**
 * ข้อมูลพนักงาน: every employee with the fields the list page shows, grouped
 * by department. Shared by the page and the Excel export so both list the same
 * rows in the same order. Callers must have called dbConnect() first.
 *
 * Department: departmentId when set (a missing department → no department),
 * else the department code — the rule of the departments page's count.
 * Account: Employee.userId points at a user that still exists.
 */

const FIELDS = "empAutoId firstName lastName titleTh firstNameTh lastNameTh nickName department departmentId position phone email photoUrl photoCrop userId";
const DEFAULT_COLOR = "#475569";
const clean = (v) => (typeof v === "string" ? v.trim() : "");
const byTh = (a, b) => a.localeCompare(b, "th");

export async function loadEmployeeDirectory() {
  const [docs, departments] = await Promise.all([
    Employee.find({}).select(FIELDS).lean(),
    Department.find({}).select("_id code name color").lean(),
  ]);
  const users = await User.find({ _id: { $in: docs.map((e) => e.userId).filter(Boolean) } }).select("_id status").lean();
  const userStatus = new Map(users.map((u) => [String(u._id), u.status || "active"]));

  const byId = new Map(departments.map((d) => [String(d._id), d]));
  const byCode = new Map(departments.map((d) => [d.code, d]));
  const deptOf = (e) => (e.departmentId ? byId.get(String(e.departmentId)) : byCode.get(e.department)) || null;

  const rows = docs.map((e) => {
    const dept = deptOf(e);
    const status = e.userId ? userStatus.get(String(e.userId)) : undefined;
    const thaiFull = employeeFullNameTh(e);
    const display = employeeDisplayName(e);
    const nameEn = employeeNameEn(e);
    const row = {
      id: String(e._id),
      code: e.empAutoId != null ? String(e.empAutoId) : "",
      nameTh: thaiFull || display || nameEn || "-",
      nameThPlain: [clean(e.firstNameTh), clean(e.lastNameTh)].filter(Boolean).join(" "),
      titleTh: clean(e.titleTh),
      firstNameTh: clean(e.firstNameTh),
      lastNameTh: clean(e.lastNameTh),
      nameEn,
      nickName: clean(e.nickName),
      position: clean(e.position),
      phone: clean(e.phone),
      email: clean(e.email),
      photoUrl: e.photoUrl || null,
      photoCrop: normalizePhotoCrop(e.photoCrop),
      deptKey: dept ? String(dept._id) : NO_DEPARTMENT,
      deptName: dept ? dept.name || dept.code : NO_DEPARTMENT_LABEL,
      hasAccount: status !== undefined,
      accountStatus: status === undefined ? "none" : status, // export only — the page does not send it
    };
    row.search = rowSearchText(row);
    return row;
  });

  // Groups in department-name order, "ไม่ระบุแผนก" last; rows by name inside.
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.deptKey)) {
      const d = r.deptKey === NO_DEPARTMENT ? null : byId.get(r.deptKey);
      groups.set(r.deptKey, { key: r.deptKey, code: d?.code || "", name: r.deptName, color: d?.color || DEFAULT_COLOR, rows: [] });
    }
    groups.get(r.deptKey).rows.push(r);
  }
  const ordered = [...groups.values()].sort((a, b) =>
    a.key === NO_DEPARTMENT ? 1 : b.key === NO_DEPARTMENT ? -1 : byTh(a.name, b.name) || byTh(a.code, b.code)
  );
  // Sorted by name without the title ("นาย…" would otherwise group by title).
  const sortName = (r) => r.nameThPlain || r.nameEn || r.nameTh;
  for (const g of ordered) g.rows.sort((a, b) => byTh(sortName(a), sortName(b)) || a.code.localeCompare(b.code, "en", { numeric: true }));

  return {
    groups: ordered,
    total: rows.length,
    departmentCount: ordered.filter((g) => g.key !== NO_DEPARTMENT).length,
    noAccountCount: rows.filter((r) => !r.hasAccount).length,
  };
}
