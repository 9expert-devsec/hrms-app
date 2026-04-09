// src/app/(protected)/dashboard/hrm/employee-my-team/MyTeamClient.jsx
"use client";

import Link from "next/link";
import { Crown, Users } from "lucide-react";

/* ── design tokens ─────────────────────────────────── */
const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const LIME = "#D4F73F";
const SLATE = "#808A95";
const ICE = "#F8FAFD";

/* ---------- small helpers ---------- */
const avatar = (u) =>
  !u ? "/avatar-default.png" : u.startsWith("http") || u.startsWith("data:")
    ? u
    : u.startsWith("/") ? u : `/${u}`;

function PersonCard({ p, badge, highlight = false }) {
  if (!p) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{
          background: "#FFFFFF",
          border: "1px solid rgba(0,92,255,0.10)",
        }}
      >
        <div className="text-sm" style={{ color: SLATE }}>ยังไม่กำหนด</div>
      </div>
    );
  }
  return (
    <Link
      href={`/dashboard/hrm/employee-profile?id=${p._id}`}
      className="block rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(0,92,255,0.10)",
        boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
        textDecoration: "none",
      }}
      title="เปิดโปรไฟล์"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="relative w-10 h-10 rounded-full overflow-hidden shrink-0"
          style={{ border: "2px solid rgba(0,92,255,0.10)", background: ICE }}
        >
          <img
            src={avatar(p.photoUrl)}
            alt={p.name}
            width={40}
            height={40}
            style={{ objectFit: "cover", width: 40, height: 40 }}
          />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: NAVY }}>
            {p.name}
          </div>
          <div className="text-xs truncate" style={{ color: SLATE }}>
            {p.position || "-"} {p.level ? `• L${p.level}` : ""}
          </div>
        </div>
        {badge && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full text-xs px-2.5 py-0.5 font-semibold shrink-0"
            style={{ background: LIME, color: NAVY }}
          >
            <Crown size={13} />
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
        <section
          className="rounded-2xl p-4"
          style={{
            background: "#FFFFFF",
            border: "1px solid rgba(0,92,255,0.10)",
            boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="relative w-12 h-12 rounded-full overflow-hidden shrink-0"
              style={{ border: "2px solid rgba(0,92,255,0.12)", background: ICE }}
            >
              <img
                src={avatar(viewer.photoUrl)}
                alt={viewer.name}
                width={48}
                height={48}
                style={{ objectFit: "cover", width: 48, height: 48 }}
              />
            </div>
            <div className="min-w-0">
              <div className="font-semibold" style={{ color: NAVY }}>{viewer.name}</div>
              <div className="text-sm" style={{ color: SLATE }}>
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
            className="rounded-2xl overflow-hidden"
            style={{
              border: "1px solid rgba(0,92,255,0.10)",
              boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
            }}
          >
            {/* dept header — 9Expert Blue banner */}
            <div
              className="px-5 py-4"
              style={{
                background: BLUE,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold" style={{ color: "#FFFFFF" }}>
                  {d.name}
                  <span style={{ opacity: 0.7, fontWeight: 400 }}> • {d.code}</span>
                </div>
                <div
                  className="text-xs inline-flex items-center gap-1"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  <Users size={14} />
                  {members.length + (d.head ? 1 : 0)} คน
                </div>
              </div>
            </div>

            {/* head & members */}
            <div
              className="p-5 space-y-5"
              style={{ background: NAVY }}
            >
              <div>
                <div
                  className="text-sm mb-2 flex items-center gap-2"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  <Crown size={16} style={{ color: LIME }} />
                  Head of Department
                </div>
                <PersonCard
                  p={d.head}
                  badge="Head"
                  highlight={d.head && viewer && d.head._id === viewer._id}
                />
              </div>

              <div>
                <div
                  className="text-sm mb-2"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  Members
                </div>
                {members.length === 0 ? (
                  <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                    ยังไม่มีสมาชิก
                  </div>
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
