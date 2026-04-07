"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Mail, Phone } from "lucide-react";

// เลือกสีตัวอักษรให้อ่านชัด (ดำ/ขาว) จากสีพื้นหลังแบบหยาบ ๆ
function pickTextColor(hex) {
  if (!hex || typeof hex !== "string") return "#0f172a"; // slate-900
  const h = hex.replace("#", "");
  if (![3, 6].includes(h.length)) return "#0f172a";
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  // perceived luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0f172a" : "#ffffff";
}

export default function EmployeeGroupsClient({ groups, order, labels, deptColors }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(() => new Set()); // dept ที่เปิดอยู่

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groups;
    const out = {};
    Object.entries(groups).forEach(([dept, list]) => {
      const keep = list.filter((e) =>
        [e.name, e.nickName, String(e.empAutoId), e.position, e.email, e.phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(s))
      );
      if (keep.length) out[dept] = keep;
    });
    return out;
  }, [q, groups]);

  return (
    <>
      <div className="flex items-center gap-3">
        <input
          placeholder="Search name, emplid, autold, position, email, phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full h-11 rounded-xl bg-white/5 px-4 text-slate-100 ring-1 ring-inset ring-white/10 placeholder:text-slate-400 focus:outline-none focus:ring-indigo-400/40"
        />
      </div>

      <div className="space-y-4">
        {order.filter((k) => filtered[k]?.length).map((dept) => {
          const bg = deptColors?.[dept] || ""; // สีจาก DB
          const text = pickTextColor(bg);
          return (
            <section key={dept} className="rounded-2xl bg-white/5 ring-1 ring-inset ring-white/10">
              <button
                onClick={() => {
                  const n = new Set(open);
                  n.has(dept) ? n.delete(dept) : n.add(dept);
                  setOpen(n);
                }}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-sm font-bold rounded-lg px-2 py-1 tracking-wide ring-1 ring-white/10"
                    style={
                      bg
                        ? { backgroundColor: bg, color: text }
                        : { backgroundColor: "rgba(255,255,255,0.08)", color: "#d1d5db" }
                    }
                    title={dept}
                  >
                    {dept}
                  </span>
                  <h2 className="text-lg font-medium text-slate-100">
                    {labels?.[dept] || dept}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400">{filtered[dept].length} people</span>
                  <ChevronDown
                    size={18}
                    className={`transition-transform ${open.has(dept) ? "rotate-180" : ""} text-slate-400`}
                  />
                </div>
              </button>

              {open.has(dept) && (
                <ul className="divide-y divide-white/10">
                  {filtered[dept].map((e) => (
                    <li key={e.id} className="px-4 py-3 hover:bg-white/5/50">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 rounded-full overflow-hidden ring-1 ring-white/10">
                          <Image src={e.photoUrl} alt={e.name} fill sizes="40px" className="object-cover" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium text-slate-100 truncate">{e.name}</span>
                            {e.nickName && <span className="text-xs text-slate-400">({e.nickName})</span>}
                            <span className="text-xs rounded-md bg-white/10 px-2 py-0.5 text-slate-300">{e.empAutoId}</span>
                            <span className="text-xs text-slate-400">{e.position}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                            {e.phone && (
                              <span className="inline-flex items-center gap-1 text-slate-400">
                                <Phone size={14} /> {e.phone}
                              </span>
                            )}
                            {e.email && (
                              <span className="inline-flex items-center gap-1 text-slate-400">
                                <Mail size={14} /> {e.email}
                              </span>
                            )}
                          </div>
                        </div>

                        <Link
                          href={`/dashboard/hrm/employee-profile?id=${e.id}`}
                          className="rounded-lg px-3 py-1.5 text-sm text-indigo-300 hover:bg-white/10 ring-1 ring-white/10"
                        >
                          View
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        {Object.keys(filtered).length === 0 && (
          <div className="rounded-xl border border-white/10 p-6 text-center text-slate-400">
            No results
          </div>
        )}
      </div>
    </>
  );
}
