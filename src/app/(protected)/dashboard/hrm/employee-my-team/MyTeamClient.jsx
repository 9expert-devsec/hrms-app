// src/app/(protected)/dashboard/hrm/employee-my-team/MyTeamClient.jsx
"use client";

import Link from "next/link";
import { Crown, Users } from "lucide-react";

/* ---------- small helpers ---------- */
const avatar = (u) =>
  !u ? "/avatar-default.png" : u.startsWith("http") || u.startsWith("data:")
    ? u
    : u.startsWith("/") ? u : `/${u}`;

function PersonCard({ p, badge, highlight = false }) {
  if (!p) {
    return (
      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
        <div className="text-sm text-slate-400">ยังไม่กำหนด</div>
      </div>
    );
  }
  return (
    <Link
      href={`/dashboard/hrm/employee-profile?id=${p._id}`}
      className={`block rounded-2xl bg-white ring-1 ring-slate-200/60 shadow-sm hover:shadow-md transition-shadow ${
        highlight ? " outline-indigo-500/70" : ""
      }`}
      title="เปิดโปรไฟล์"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative w-10 h-10 rounded-full overflow-hidden ring-1 ring-slate-200 bg-slate-100 shrink-0">
          {/* ใช้ <img> เพื่อความง่าย/ไม่ผูกกับ next/image */}
          <img
            src={avatar(p.photoUrl)}
            alt={p.name}
            width={40}
            height={40}
            style={{ objectFit: "cover", width: 40, height: 40 }}
          />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {p.name}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {p.position || "-"} {p.level ? `• L${p.level}` : ""}
          </div>
        </div>
        {badge && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 text-xs px-2 py-0.5">
            <Crown size={14} />
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
}

/* ---------- main ---------- */
export default function MyTeamClient({ data }) {
  const { viewer, depts } = data || { viewer: null, depts: [] };

  return (
    <div className="space-y-8">
      {/* viewer */}
      {viewer && (
        <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-full overflow-hidden ring-1 ring-white/20 bg-slate-800">
              <img
                src={avatar(viewer.photoUrl)}
                alt={viewer.name}
                width={48}
                height={48}
                style={{ objectFit: "cover", width: 48, height: 48 }}
              />
            </div>
            <div className="min-w-0">
              <div className="text-slate-100 font-semibold">{viewer.name}</div>
              <div className="text-slate-400 text-sm">
                {viewer.position || "-"} {viewer.level ? `• L${viewer.level}` : ""}
              </div>
            </div>
          </div>
        </section>
      )}

      {depts.map((d) => {
        // กัน head ซ้ำใน members
        const members = (d.members || []).filter((m) => !d.head || m._id !== d.head._id);

        return (
          <section
            key={d._id}
            className="rounded-2xl ring-1 ring-white/10 overflow-hidden bg-[#0f172b]"
          >
            {/* dept header */}
            <div
              className="px-5 py-4"
              style={{
                background: d.color || "#334155",
                boxShadow: `inset 0 -1px 0 rgba(0,0,0,.15)`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-white font-semibold">
                  {d.name}
                  <span className="opacity-80 font-normal"> • {d.code}</span>
                </div>
                <div className="text-amber-50/90 text-xs inline-flex items-center gap-1">
                  <Users size={14} />
                  {members.length + (d.head ? 1 : 0)} คน
                </div>
              </div>
            </div>

            {/* head & members */}
            <div className="p-5 space-y-5">
              <div>
                <div className="text-slate-300 text-sm mb-2 flex items-center gap-2">
                  <Crown size={16} className="text-amber-400" />
                  Head of Department
                </div>
                <PersonCard
                  p={d.head}
                  badge="Head"
                  highlight={d.head && viewer && d.head._id === viewer._id}
                />
              </div>

              <div>
                <div className="text-slate-300 text-sm mb-2">Members</div>
                {members.length === 0 ? (
                  <div className="text-sm text-slate-400">ยังไม่มีสมาชิก</div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {members.map((m) => (
                      <PersonCard
                        key={m._id}
                        p={m}
                        highlight={viewer && m._id === viewer._id}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
