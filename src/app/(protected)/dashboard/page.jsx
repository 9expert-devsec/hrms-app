// src/app/(protected)/dashboard/page.jsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import {
  Users,
  Building2,
  CalendarCheck,
  UserPlus,
  ClipboardList,
  Contact,
  UserCircle,
} from "lucide-react";

const STAT_ICONS = [Users, Building2, CalendarCheck, UserPlus];

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const firstName = session.user.name?.split(" ")[0] || session.user.name;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const stats = [
    { label: "Employees", value: "128", sub: "Total active", iconIdx: 0 },
    { label: "Departments", value: "12", sub: "Across org", iconIdx: 1 },
    { label: "Present Today", value: "114", sub: "89% attendance", iconIdx: 2 },
    { label: "New This Month", value: "5", sub: "Since Apr 1", iconIdx: 3 },
  ];

  const quickLinks = [
    { title: "Leave Requests", desc: "Review pending approvals", href: "/dashboard/leave/approval", Icon: ClipboardList },
    { title: "Employee Directory", desc: "Browse all team members", href: "/dashboard/hrm/employee", Icon: Contact },
    { title: "My Profile", desc: "View & edit your profile", href: "/dashboard/hrm/employee-profile", Icon: UserCircle },
  ];

  return (
    <div className="space-y-8 p-2">
      {/* ── Hero Section ──────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl p-8 md:p-10"
        style={{
          background: "linear-gradient(135deg, #0D1B2A 0%, #005CFF 60%, #2486FF 100%)",
        }}
      >
        {/* Decorative circles */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-10"
          style={{ background: "#D4F73F" }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full opacity-[0.07]"
          style={{ background: "#D4F73F" }}
        />

        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", fontWeight: 500, letterSpacing: "0.025em" }}>
          {greeting}
        </p>
        <h1 style={{ color: "#FFFFFF", fontSize: "clamp(1.75rem, 4vw, 2.25rem)", fontWeight: 600, marginTop: "4px" }}>
          Welcome back,{" "}
          <span style={{ color: "#D4F73F" }}>{firstName}</span>
        </h1>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", lineHeight: 1.6, maxWidth: "32rem", marginTop: "8px" }}>
          Here&apos;s what&apos;s happening across your organization today.
          Stay on top of your team and approvals.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "rgba(212,247,63,0.15)", color: "#D4F73F" }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#D4F73F" }} />
            System Online
          </span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
            Role: <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{session.user.role}</span>
          </span>
        </div>
      </section>

      {/* ── KPI Stat Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const IconComp = STAT_ICONS[s.iconIdx];
          return (
            <div
              key={s.label}
              className="group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
              style={{
                background: "#0D1B2A",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Hover glow */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  boxShadow: "inset 0 0 40px rgba(212,247,63,0.06), 0 8px 32px rgba(212,247,63,0.08)",
                  borderColor: "rgba(212,247,63,0.2)",
                }}
              />

              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <p style={{ color: "#808A95", fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {s.label}
                  </p>
                  <p style={{ color: "#D4F73F", fontSize: "2.25rem", fontWeight: 600, letterSpacing: "-0.02em", marginTop: "8px", lineHeight: 1 }}>
                    {s.value}
                  </p>
                  <p style={{ color: "#808A95", fontSize: "12px", marginTop: "4px" }}>
                    {s.sub}
                  </p>
                </div>
                <div
                  className="transition-transform duration-300 group-hover:scale-110"
                  style={{ color: "rgba(128,138,149,0.4)" }}
                >
                  <IconComp size={28} strokeWidth={1.5} />
                </div>
              </div>

              {/* Bottom accent bar */}
              <div
                className="absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-500 group-hover:w-full"
                style={{ background: "linear-gradient(90deg, #D4F73F, #005CFF)" }}
              />
            </div>
          );
        })}
      </div>

      {/* ── Quick Access Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {quickLinks.map((card) => (
          <a
            key={card.title}
            href={card.href}
            className="group relative overflow-hidden rounded-2xl p-5 no-underline transition-all duration-300 hover:-translate-y-0.5"
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(0,92,255,0.10)",
              boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ boxShadow: "0 6px 20px rgba(13,27,42,0.10)" }}
            />
            <div className="relative z-10 flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "rgba(0,92,255,0.08)", color: "#005CFF" }}
              >
                <card.Icon size={18} strokeWidth={1.8} />
              </div>
              <div>
                <h3 style={{ color: "#0D1B2A", fontSize: "14px", fontWeight: 600 }}>
                  {card.title}
                </h3>
                <p style={{ color: "#808A95", fontSize: "12px", marginTop: "2px" }}>
                  {card.desc}
                </p>
              </div>
            </div>
            <span
              className="relative z-10 mt-3 inline-block text-xs font-medium transition-colors duration-200 group-hover:!text-[#D4F73F]"
              style={{ color: "#005CFF" }}
            >
              Go &rarr;
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
