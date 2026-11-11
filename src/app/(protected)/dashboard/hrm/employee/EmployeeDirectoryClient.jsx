"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronRight, Download, Mail, Pencil, Phone, Plus, Search } from "lucide-react";
import PersonAvatar from "../../../../../components/PersonAvatar";
import { BLUE, BTN_PRIMARY, BTN_SECONDARY, CodeChip, FOCUS, INPUT, MUTED, NAVY, SLATE, Summary } from "../../../../../components/hr/hrUi";
import { NO_DEPARTMENT, NO_DEPARTMENT_LABEL, filtersActive, rowMatches } from "@/lib/employeeDirectoryFilter";

function AccountPill({ has }) {
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
      style={has ? { background: "#DCFCE7", color: "#15803D" } : { background: "#FEF3C7", color: "#92400E" }}
      data-testid="emp-account"
    >
      {has ? "มีบัญชี" : "ไม่มีบัญชี"}
    </span>
  );
}

function subLine(r) {
  const en = r.nameEn && r.nameEn !== r.nameTh ? r.nameEn : "";
  return [en, r.nickName].filter(Boolean).join(" · ");
}

function Contact({ r }) {
  if (!r.phone && !r.email) return <span style={{ color: MUTED }}>—</span>;
  return (
    <div className="space-y-1 text-[13px]" style={{ color: SLATE }}>
      {r.phone && (
        <div className="flex items-center gap-1.5" data-testid="emp-phone"><Phone size={14} aria-hidden className="shrink-0" /> {r.phone}</div>
      )}
      {r.email && (
        <div className="flex items-center gap-1.5 break-all" data-testid="emp-email"><Mail size={14} aria-hidden className="shrink-0" /> {r.email}</div>
      )}
    </div>
  );
}

function Actions({ r, canEdit }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {canEdit && (
        <Link
          href={`/dashboard/hrm/employee/edit?id=${r.id}`}
          aria-label={`แก้ไขข้อมูล ${r.nameTh}`}
          className={`grid h-11 w-11 place-items-center rounded-[10px] md:h-9 md:w-9 ${FOCUS}`}
          style={{ background: "#F5F8FF", color: BLUE }}
          data-testid="emp-edit"
        >
          <Pencil size={16} aria-hidden />
        </Link>
      )}
      <Link
        href={`/dashboard/hrm/employee-profile?id=${r.id}`}
        aria-label={`ดูโปรไฟล์ ${r.nameTh}`}
        className={`grid h-11 w-11 place-items-center rounded-[10px] md:h-9 md:w-9 ${FOCUS}`}
        style={{ color: SLATE }}
        data-testid="emp-view"
      >
        <ChevronRight size={18} aria-hidden />
      </Link>
    </div>
  );
}

function Person({ r }) {
  const sub = subLine(r);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PersonAvatar src={r.photoUrl} name={r.nameThPlain || r.nameEn || r.nameTh} size={40} />
      <div className="min-w-0">
        <div className="break-words text-[15px] font-semibold" style={{ color: NAVY }} data-testid="emp-name">{r.nameTh}</div>
        {sub && <div className="break-words text-[13px]" style={{ color: SLATE }} data-testid="emp-sub">{sub}</div>}
      </div>
    </div>
  );
}

export default function EmployeeDirectoryClient({ groups, total, departmentCount, noAccountCount, canCreate, canEdit }) {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [noAccount, setNoAccount] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());

  const filters = { q, dept, noAccount };
  const active = filtersActive(filters);
  const shown = useMemo(
    () => groups.map((g) => ({ ...g, rows: g.rows.filter((r) => rowMatches(r, { q, dept, noAccount })) })).filter((g) => g.rows.length > 0),
    [groups, q, dept, noAccount]
  );
  const shownCount = shown.reduce((n, g) => n + g.rows.length, 0);
  const isOpen = (key) => active || !collapsed.has(key);
  const toggle = (key) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const exportHref = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (dept) p.set("dept", dept);
    if (noAccount) p.set("noAccount", "1");
    const s = p.toString();
    return `/api/employees/export${s ? `?${s}` : ""}`;
  }, [q, dept, noAccount]);

  return (
    <div className="space-y-4 md:space-y-5">
      {/* summary */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Summary value={total} testid="emp-summary">คน · {departmentCount} แผนก</Summary>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <a href={exportHref} className={BTN_SECONDARY} data-testid="emp-export">
            <Download size={16} aria-hidden /> ส่งออก Excel
          </a>
          {canCreate && (
            <Link href="/dashboard/hrm/employee/create" className={BTN_PRIMARY} data-testid="emp-create">
              <Plus size={16} aria-hidden /> เพิ่มพนักงาน
            </Link>
          )}
        </div>
      </div>

      {/* toolbar */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">ค้นหาพนักงาน</span>
          <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อ ชื่อเล่น รหัส ตำแหน่ง อีเมล หรือเบอร์โทร"
            className={`${INPUT} pl-10`}
            data-testid="emp-search"
          />
        </label>
        <div className="flex gap-2">
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            aria-label="แผนก"
            className={`${INPUT} min-w-0 flex-1 md:w-56 md:flex-none`}
            data-testid="emp-dept"
          >
            <option value="">ทุกแผนก</option>
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.key === NO_DEPARTMENT ? NO_DEPARTMENT_LABEL : g.code ? `${g.code} · ${g.name}` : g.name}
              </option>
            ))}
          </select>
          {noAccountCount > 0 && (
            <button
              type="button"
              aria-pressed={noAccount}
              onClick={() => setNoAccount((v) => !v)}
              className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold ${FOCUS}`}
              style={{ background: "#FEF3C7", color: "#92400E", border: `1px solid ${noAccount ? "#92400E" : "transparent"}` }}
              data-testid="emp-noaccount"
            >
              <AlertTriangle size={15} aria-hidden /> ยังไม่มีบัญชี {noAccountCount}
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-[14px]" style={{ border: "1px solid #E3EAF5", color: SLATE }} data-testid="emp-empty">
          ไม่พบพนักงานที่ตรงกับการค้นหา
        </div>
      ) : (
        <>
          {/* tablet / desktop: table */}
          <div className="hidden overflow-hidden rounded-2xl bg-white md:block" style={{ border: "1px solid #E3EAF5" }} data-testid="emp-table">
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col />
                <col className="w-[84px]" />
                <col className="w-[18%]" />
                <col className="w-[24%]" />
                <col className="w-[104px]" />
                <col className={canEdit ? "w-[96px]" : "w-[56px]"} />
              </colgroup>
              <thead>
                <tr className="text-[13px] font-semibold" style={{ background: "#F8FAFD", color: SLATE }}>
                  <th className="p-4 font-semibold">พนักงาน</th>
                  <th className="p-4 font-semibold">รหัส</th>
                  <th className="p-4 font-semibold">ตำแหน่ง</th>
                  <th className="p-4 font-semibold">ติดต่อ</th>
                  <th className="p-4 font-semibold">บัญชี</th>
                  <th className="p-4"><span className="sr-only">จัดการ</span></th>
                </tr>
              </thead>
              {shown.map((g) => {
                const open = isOpen(g.key);
                return (
                  <tbody key={g.key} data-testid="emp-group" data-key={g.key}>
                    <tr style={{ background: "#F5F8FF", borderTop: "1px solid #EEF2F8" }}>
                      <th colSpan={6} className="p-0 text-left font-normal">
                        <GroupHeader g={g} open={open} onToggle={() => toggle(g.key)} disabled={active} />
                      </th>
                    </tr>
                    {open &&
                      g.rows.map((r) => (
                        <tr key={r.id} style={{ borderTop: "1px solid #EEF2F8" }} data-testid="emp-row" data-id={r.id}>
                          <td className="p-4 align-middle"><Person r={r} /></td>
                          <td className="p-4 align-middle text-[14px] font-medium" style={{ color: SLATE }} data-testid="emp-code">{r.code || "—"}</td>
                          <td className="break-words p-4 align-middle text-[14px]" style={{ color: NAVY }}>{r.position || "—"}</td>
                          <td className="p-4 align-middle"><Contact r={r} /></td>
                          <td className="p-4 align-middle"><AccountPill has={r.hasAccount} /></td>
                          <td className="p-4 align-middle"><Actions r={r} canEdit={canEdit} /></td>
                        </tr>
                      ))}
                  </tbody>
                );
              })}
            </table>
          </div>

          {/* phone: stacked cards */}
          <div className="space-y-3 md:hidden" data-testid="emp-cards">
            {shown.map((g) => {
              const open = isOpen(g.key);
              return (
                <section key={g.key} className="overflow-hidden rounded-2xl bg-white" style={{ border: "1px solid #E3EAF5" }} data-testid="emp-group-card" data-key={g.key}>
                  <div style={{ background: "#F5F8FF" }}>
                    <GroupHeader g={g} open={open} onToggle={() => toggle(g.key)} disabled={active} />
                  </div>
                  {open &&
                    g.rows.map((r) => (
                      <div key={r.id} className="space-y-3 p-4" style={{ borderTop: "1px solid #EEF2F8" }} data-testid="emp-card" data-id={r.id}>
                        <Person r={r} />
                        <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
                          <dt style={{ color: SLATE }}>รหัส</dt>
                          <dd className="font-medium" style={{ color: SLATE }}>{r.code || "—"}</dd>
                          <dt style={{ color: SLATE }}>ตำแหน่ง</dt>
                          <dd style={{ color: NAVY }}>{r.position || "—"}</dd>
                          <dt style={{ color: SLATE }}>ติดต่อ</dt>
                          <dd><Contact r={r} /></dd>
                        </dl>
                        <div className="flex items-center justify-between gap-2">
                          <AccountPill has={r.hasAccount} />
                          <Actions r={r} canEdit={canEdit} />
                        </div>
                      </div>
                    ))}
                </section>
              );
            })}
          </div>
          <p className="sr-only" aria-live="polite">พบ {shownCount} คน</p>
        </>
      )}
    </div>
  );
}

function GroupHeader({ g, open, onToggle, disabled }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-expanded={open}
      className={`flex min-h-[48px] w-full items-center gap-3 px-4 py-2.5 text-left disabled:cursor-default ${FOCUS}`}
      data-testid="emp-group-toggle"
    >
      <ChevronDown size={18} aria-hidden className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} style={{ color: SLATE }} />
      <CodeChip code={g.code} color={g.color} />
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold" style={{ color: NAVY }} data-testid="emp-group-name">{g.key === NO_DEPARTMENT ? NO_DEPARTMENT_LABEL : g.name}</span>
      <span className="shrink-0 text-[13px]" style={{ color: SLATE }} data-testid="emp-group-count">{g.rows.length} คน</span>
    </button>
  );
}
