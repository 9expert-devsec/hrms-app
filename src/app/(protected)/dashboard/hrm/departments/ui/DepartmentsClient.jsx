"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Search, Users } from "lucide-react";
import { BLUE, CodeChip, FOCUS, INPUT, LINE, MUTED, NAVY, SLATE } from "../../../../../../components/hr/hrUi";

/** แผนกและตำแหน่ง cards + search (name, code, description). */
export default function DepartmentsClient({ items, canEdit = false }) {
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((d) => [d.name, d.code, d.description].some((v) => (v || "").toLowerCase().includes(s)));
  }, [q, items]);

  return (
    <div className="space-y-4">
      <label className="relative block">
        <span className="sr-only">ค้นหาแผนก</span>
        <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อแผนก รหัส หรือคำอธิบาย"
          className={`${INPUT} pl-10`}
          data-testid="dept-search"
        />
      </label>

      {shown.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-[14px]" style={{ border: `1px solid ${LINE}`, color: SLATE }} data-testid="dept-empty">
          ไม่พบแผนกที่ตรงกับการค้นหา
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => (
            <li
              key={d._id}
              className="flex flex-col gap-3.5 rounded-[18px] bg-white px-5 py-5"
              style={{ border: `1px solid ${LINE}` }}
              data-testid="dept-card"
              data-code={d.code}
            >
              <div className="flex items-center gap-2.5">
                <CodeChip code={d.code} color={d.color} />
                <h2 className="min-w-0 flex-1 break-words text-[16px] font-semibold" style={{ color: NAVY }} data-testid="dept-name">{d.name}</h2>
                {canEdit && (
                  <Link
                    href={`/dashboard/hrm/departments/${d._id}/edit`}
                    aria-label={`แก้ไขแผนก ${d.name}`}
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] md:h-9 md:w-9 ${FOCUS}`}
                    style={{ background: "#F5F8FF", color: BLUE }}
                    data-testid="dept-edit"
                  >
                    <Pencil size={16} aria-hidden />
                  </Link>
                )}
              </div>

              {d.description && <p className="text-[13px]" style={{ color: SLATE }} data-testid="dept-desc">{d.description}</p>}

              <div className="rounded-xl px-3 py-2.5" style={{ background: "#FFFBEA" }} data-testid="dept-head">
                {d.headName ? (
                  <p className="text-[13px]">
                    <span style={{ color: SLATE }}>หัวหน้าแผนก</span>{" "}
                    <span className="font-semibold" style={{ color: NAVY }} data-testid="dept-head-name">{d.headName}</span>
                  </p>
                ) : (
                  <p className="text-[13px] font-medium" style={{ color: "#92400E" }}>ยังไม่ได้กำหนดหัวหน้าแผนก</p>
                )}
              </div>

              <p className="flex items-center gap-1.5 text-[13px]" style={{ color: NAVY }} data-testid="dept-count">
                <Users size={15} aria-hidden style={{ color: SLATE }} /> พนักงาน {d.empCount} คน
              </p>

              <div>
                <p className="text-[12px] font-semibold" style={{ color: SLATE }}>ตำแหน่ง {d.positions.length}</p>
                {d.positions.length === 0 ? (
                  <p className="mt-1.5 text-[13px]" style={{ color: SLATE }} data-testid="dept-no-positions">ยังไม่มีตำแหน่ง</p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid="dept-positions">
                    {d.positions.map((p, i) => (
                      <span key={`${p}-${i}`} className="rounded-full bg-white px-2.5 py-0.5 text-[12px]" style={{ border: "1px solid #D6E0F0", color: NAVY }}>
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
