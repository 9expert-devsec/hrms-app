"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Users, BarChart2, Shield } from "lucide-react";

const features = [
  {
    icon: Users,
    label: "Employee Management",
    desc: "จัดการข้อมูลพนักงานครบวงจร",
  },
  {
    icon: BarChart2,
    label: "Analytics & Reports",
    desc: "รายงานและ Dashboard Real-time",
  },
  {
    icon: Shield,
    label: "Role-Based Access",
    desc: "ระบบสิทธิ์ RBAC ปลอดภัยสูง",
  },
];

/* ── Generate star data at module level so it's stable across renders ── */
const stars = Array.from({ length: 65 }, (_, i) => ({
  id: i,
  top: `${(((i * 17 + 3) * 53) % 97) + 1}%`,
  left: `${(((i * 31 + 7) * 41) % 98) + 1}%`,
  size: 2 + (i % 3),
  opacity: 0.15 + (i % 4) * 0.05,
  delay: -(i * 0.7) % 6,
  duration: 3 + (i % 4),
}));

const CSS_ANIMATIONS = `
@keyframes floatY {
  0%, 100% { transform: translateY(0px); opacity: 0.6; }
  50% { transform: translateY(-8px); opacity: 1; }
}
@keyframes rotateSlow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes rotateSlowReverse {
  from { transform: rotate(0deg); }
  to { transform: rotate(-360deg); }
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.3); }
}
`;

export default function HomePage() {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "#F8FAFD" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS_ANIMATIONS }} />

      {/* ── Navbar ─────────────────────────────────────────────── */}
      {/* <header
        className="sticky top-0 z-50 backdrop-blur"
        style={{
          background: "rgba(248,250,253,0.85)",
          borderBottom: "1px solid rgba(0,92,255,0.08)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: "36px",
                height: "36px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                src="/logo-9hrms.png"
                alt="9Expert"
                width={36}
                height={36}
                style={{ objectFit: "contain", width: "100%", height: "100%" }}
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span
                className="font-extrabold text-sm"
                style={{ color: "#0D1B2A" }}
              >
                9Expert
              </span>
              <span
                className="text-[10px] font-medium"
                style={{ color: "#5E6A7E" }}
              >
                Knowledge Provider
              </span>
            </div>
          </div>

          <Link
            href="/login"
            className="text-sm font-semibold transition-all duration-200"
            style={{ color: "#005CFF" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0D1B2A")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#005CFF")}
          >
            Sign in →
          </Link>
        </div>
      </header> */}

      {/* ── Hero ───────────────────────────────────────────────── */}
      <main
        className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16"
        style={{ position: "relative", overflow: "hidden" }}
      >
        {/* ── Particle stars ── */}
        {stars.map((s) => (
          <span
            key={s.id}
            style={{
              position: "absolute",
              top: s.top,
              left: s.left,
              width: `${s.size}px`,
              height: `${s.size}px`,
              borderRadius: "50%",
              background:
                s.id % 3 === 0
                  ? "rgba(72,176,255,0.3)"
                  : "rgba(0,92,255,0.15)",
              animation: `floatY ${s.duration}s ease-in-out infinite`,
              animationDelay: `${s.delay}s`,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        ))}

        {/* ── Orbit rings ── */}
        <div
          style={{
            position: "absolute",
            width: "300px",
            height: "300px",
            border: "1px solid rgba(0,92,255,0.06)",
            borderRadius: "50%",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(20deg)",
            animation: "rotateSlow 20s linear infinite",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "500px",
            height: "200px",
            border: "1px solid rgba(0,92,255,0.06)",
            borderRadius: "50%",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-15deg)",
            animation: "rotateSlowReverse 30s linear infinite",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "700px",
            height: "300px",
            border: "1px solid rgba(0,92,255,0.06)",
            borderRadius: "50%",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(5deg)",
            animation: "rotateSlow 45s linear infinite",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* ── Center content ── */}
        <div
          style={{ position: "relative", zIndex: 1 }}
          className="flex flex-col items-center"
        >
          {/* Large logo */}
          <div
            style={{
              width: "80px",
              height: "80px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              src="/logo-9hrms.png"
              alt="9Expert"
              width={80}
              height={80}
              style={{ objectFit: "contain", width: "100%", height: "100%" }}
            />
          </div>

          <span
            className="mt-3 font-extrabold"
            style={{ fontSize: "28px", color: "#0D1B2A" }}
          >
            9Expert
          </span>
          <span
            className="mt-0.5"
            style={{ fontSize: "14px", color: "#5E6A7E" }}
          >
            HRMS Portal
          </span>

          {/* Badge */}
          {/* <span
            className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold"
            style={{ background: "#0D1B2A", color: "#D4F73F" }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: "#D4F73F" }}
            />
            Internal System — Authorized Personnel Only
          </span> */}

          {/* Heading */}
          {/* <h1 className="mt-5 leading-tight">
            <span
              className="block font-extrabold"
              style={{ fontSize: "40px", color: "#0D1B2A" }}
            >
              ระบบบริหารทรัพยากรบุคคล
            </span>
            <span
              className="block font-extrabold"
              style={{
                fontSize: "40px",
                background: "linear-gradient(90deg, #005CFF, #48B0FF)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
              }}
            >
              ที่ทันสมัยและครบวงจร
            </span>
          </h1>

          <p
            className="mt-4 leading-relaxed"
            style={{
              color: "#5E6A7E",
              fontSize: "16px",
              maxWidth: "480px",
            }}
          >
            จัดการพนักงาน การลา เวลาทำงาน และอื่นๆ ในที่เดียว
          </p> */}

          {/* CTA Buttons */}
          <div className="mt-8 flex gap-3 flex-wrap justify-center">
            <Link
              href="/login"
              className="px-7 py-3 rounded-xl font-bold text-sm shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
              style={{ background: "#D4F73F", color: "#0D1B2A" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#D8F852")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#D4F73F")
              }
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="px-7 py-3 rounded-xl font-bold text-sm border-2 transition-all duration-200 hover:-translate-y-0.5"
              style={{
                borderColor: "#005CFF",
                color: "#005CFF",
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#005CFF";
                e.currentTarget.style.color = "#FFFFFF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#005CFF";
              }}
            >
              Go to Dashboard
            </Link>
          </div>

          {/* Feature cards */}
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
            {features.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-3 rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid rgba(0,92,255,0.10)",
                  boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
                }}
              >
                <div
                  className="h-10 w-10 rounded-xl grid place-items-center"
                  style={{ background: "rgba(0,92,255,0.08)" }}
                >
                  <Icon size={18} style={{ color: "#005CFF" }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold" style={{ color: "#0D1B2A" }}>
                    {label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#5E6A7E" }}>
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer
        className="py-5 text-center text-xs"
        style={{
          borderTop: "1px solid rgba(0,92,255,0.08)",
          background: "#FFFFFF",
          color: "#5E6A7E",
        }}
      >
        © {new Date().getFullYear()} 9 Expert Company Limited · Internal use
        only
      </footer>
    </div>
  );
}
