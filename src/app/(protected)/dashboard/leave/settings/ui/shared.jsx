"use client";

import { Search } from "lucide-react";
import { INPUT, LINE, MUTED, NAVY, SLATE } from "../../../../../../components/hr/hrUi";

/** Shared bits of the ตั้งค่าการลา tabs. */

export const fmtDays = (n) => (n === null || n === undefined ? "ไม่จำกัด" : `${Number.isInteger(n) ? n : Number(n).toFixed(1)} วัน`);

export async function callApi(url, { method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw Object.assign(new Error(j.message || "ดำเนินการไม่สำเร็จ"), { field: j.field, status: res.status });
  return j;
}

export function SectionCard({ title, children, testid, aside }) {
  return (
    <section className="rounded-[18px] bg-white p-5 md:p-6" style={{ border: `1px solid ${LINE}` }} data-testid={testid}>
      {(title || aside) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-[16px] font-bold" style={{ color: NAVY }}>{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function FieldLabel({ htmlFor, children, hint }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium" style={{ color: SLATE }}>
      {children}
      {hint && <span className="ml-1 font-normal" style={{ color: "#8592A6" }}>{hint}</span>}
    </label>
  );
}

/** Search + department filter shared by ผู้อนุมัติ and โควตาวันลา. */
export function EmployeeFilter({ filter, setFilter, departments }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <label className="relative block min-w-0 flex-1">
        <span className="sr-only">ค้นหาพนักงาน</span>
        <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
        <input
          type="search"
          value={filter.q}
          onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
          placeholder="ค้นหาชื่อหรือตำแหน่ง"
          className={`${INPUT} pl-10`}
          data-testid="leave-filter-q"
        />
      </label>
      <select
        value={filter.dept}
        onChange={(e) => setFilter((f) => ({ ...f, dept: e.target.value }))}
        aria-label="แผนก"
        className={`${INPUT} sm:w-60`}
        data-testid="leave-filter-dept"
      >
        <option value="">ทุกแผนก</option>
        {departments.map((d) => (
          <option key={d._id} value={d._id}>{`${d.code} · ${d.name}`}</option>
        ))}
        <option value="none">ไม่ระบุแผนก</option>
      </select>
    </div>
  );
}

export function filterEmployees(employees, { q, dept }) {
  const s = q.trim().toLowerCase();
  return employees.filter(
    (e) =>
      (!s || e.search.includes(s) || e.name.toLowerCase().includes(s) || e.position.toLowerCase().includes(s)) &&
      (!dept || (dept === "none" ? !e.departmentId : e.departmentId === dept))
  );
}
