"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

const LEVEL_LABEL = {
  1: "Newbie",
  2: "Junior",
  3: "Senior",
  4: "Lead",
  5: "Manager",
  6: "CEO/COO",
};

export default function DepartmentsClient({ initialItems, canEdit = false }) {
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return initialItems;
    return initialItems.filter((d) => {
      const name = d.name?.toLowerCase() ?? "";
      const code = d.code?.toLowerCase() ?? "";
      const desc = d.description?.toLowerCase() ?? "";
      return name.includes(s) || code.includes(s) || desc.includes(s);
    });
  }, [q, initialItems]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, code, description..."
          className="w-full rounded-xl px-4 py-2.5 focus:outline-none"
          style={{
            background: "#FFFFFF",
            border: "1px solid rgba(0,92,255,0.12)",
            color: "#0D1B2A",
          }}
        />
        <Search className="absolute right-3 top-2.5 h-5 w-5" style={{ color: "#808A95" }} />
      </div>

      {/* Grid */}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((d) => (
          <li
            key={d._id}
            className="transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(0,92,255,0.10)",
              borderRadius: "16px",
              boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
              padding: "16px",
            }}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: d.color || "#005CFF" }}
                    aria-hidden
                  />
                  <span style={{ color: "#808A95", fontSize: "13px" }}>{d.code}</span>
                </div>
                <h3 style={{ color: "#0D1B2A", fontWeight: 600, fontSize: "17px" }}>
                  {d.name}
                </h3>
                <div style={{ color: "#808A95", fontSize: "13px" }}>
                  {Number(d._empCount ?? 0)}{" "}
                  {Number(d._empCount ?? 0) === 1 ? "person" : "people"}
                </div>
              </div>

              {canEdit && (
                <Link
                  href={`/dashboard/hrm/departments/${d._id}/edit`}
                  className="no-underline text-sm transition-colors duration-150"
                  style={{ color: "#005CFF", fontWeight: 500 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#0D1B2A"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#005CFF"; }}
                >
                  Edit
                </Link>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(d.allowLevels ?? d.allowedLevels ?? []).map((lv) => (
                <span
                  key={lv}
                  title={`Level ${lv}`}
                  style={{
                    background: "#F8FAFD",
                    border: "1px solid rgba(0,92,255,0.12)",
                    color: "#334155",
                    borderRadius: "99px",
                    fontSize: "11px",
                    fontWeight: 500,
                    padding: "2px 8px",
                  }}
                >
                  {LEVEL_LABEL[lv] ?? lv}
                </span>
              ))}
            </div>

            {d.description ? (
              <p className="mt-3 line-clamp-2" style={{ color: "#475569", fontSize: "13px", margin: 0, marginTop: "12px" }}>
                {d.description}
              </p>
            ) : null}
          </li>
        ))}

        {items.length === 0 && (
          <li className="col-span-full">
            <div
              className="p-10 text-center"
              style={{
                borderRadius: "12px",
                border: "1px dashed rgba(0,92,255,0.15)",
                color: "#808A95",
              }}
            >
              ไม่พบข้อมูลที่ค้นหา
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
