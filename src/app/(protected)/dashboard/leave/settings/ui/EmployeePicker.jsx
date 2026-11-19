"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import PersonAvatar from "../../../../../../components/PersonAvatar";
import { FOCUS, INPUT, LINE, MUTED, NAVY, NoAccountPill, SLATE } from "../../../../../../components/hr/hrUi";
import Dialog from "./Dialog";

/**
 * Pick one employee (same look as the HOD page's picker). `employees` are the
 * page's rows; `exclude` ids are not offered.
 */
export default function EmployeePicker({ title, employees, exclude = [], onPick, onClose }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const ex = new Set(exclude.filter(Boolean));
    const s = q.trim().toLowerCase();
    return employees.filter((e) => !ex.has(e._id) && (!s || e.search.includes(s) || e.position.toLowerCase().includes(s) || e.departmentCode.toLowerCase().includes(s)));
  }, [employees, exclude, q]);

  return (
    <Dialog title={title} onClose={onClose} testid="leave-picker" z={80}>
      <label className="relative mb-2 block">
        <span className="sr-only">ค้นหาพนักงาน</span>
        <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
        <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ ตำแหน่ง หรือแผนก" className={`${INPUT} pl-10`} data-testid="leave-picker-search" />
      </label>
      <div className="rounded-xl" style={{ border: `1px solid ${LINE}` }}>
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[13px]" style={{ color: SLATE }}>
            <Users size={24} aria-hidden style={{ opacity: 0.4, marginBottom: 8 }} />
            ไม่พบพนักงานที่ตรงเงื่อนไข
          </div>
        ) : (
          shown.map((e) => (
            <button
              type="button"
              key={e._id}
              onClick={() => onPick(e)}
              className={`flex min-h-[52px] w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-[#F5F8FF] ${FOCUS}`}
              style={{ borderBottom: "1px solid #EEF2F8" }}
              data-testid="leave-picker-option"
              data-id={e._id}
            >
              <PersonAvatar src={e.photoUrl} crop={e.photoCrop} name={e.name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[14px] font-semibold" style={{ color: NAVY }}>{e.name}</span>
                  {!e.hasAccount && <NoAccountPill />}
                </span>
                <span className="block text-[12px]" style={{ color: SLATE }}>{[e.departmentCode, e.position].filter(Boolean).join(" • ")}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </Dialog>
  );
}
