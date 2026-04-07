"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Users, BarChart2, Shield } from "lucide-react";

const AstroGLB = dynamic(() => import("src/components/AstroGLB"), {
  ssr: false,
});

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

export default function HomePage() {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "#F8FAFD" }}>
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 backdrop-blur"
        style={{
          background: "rgba(248,250,253,0.85)",
          borderBottom: "1px solid rgba(0,92,255,0.08)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="h-9 w-9 rounded-xl grid place-items-center shadow-sm"
              style={{ background: "#005CFF" }}
            >
              <span className="text-white font-extrabold text-base">9</span>
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
                style={{ color: "#808A95" }}
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
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        {/* 3-D mascot */}
        <AstroGLB scale={0.34} heightClass="h-44 md:h-56" />

        {/* Badge — Lime accent on navy */}
        <span
          className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold"
          style={{ background: "#0D1B2A", color: "#D4F73F" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ background: "#D4F73F" }}
          />
          Internal System — Authorized Personnel Only
        </span>

        {/* Heading */}
        <h1
          className="mt-5 text-4xl md:text-5xl font-extrabold leading-tight"
          style={{ color: "#0D1B2A" }}
        >
          Welcome to <span style={{ color: "#005CFF" }}>9Expert HRM</span>
        </h1>

        <p
          className="mt-4 max-w-lg text-base md:text-lg leading-relaxed"
          style={{ color: "#808A95" }}
        >
          Internal Human Resource Management System.{" "}
          <br className="hidden md:block" />
          Manage employees, attendance, and more — all in one place.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex gap-3 flex-wrap justify-center">
          {/* Primary CTA — Lime accent (signature 9Expert) */}
          <Link
            href="/login"
            className="px-7 py-3 rounded-xl font-bold text-sm shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
            style={{ background: "#D4F73F", color: "#0D1B2A" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#E4FF6B")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#D4F73F")}
          >
            Sign in
          </Link>
          {/* Secondary CTA — outlined blue */}
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
                <p className="text-xs mt-0.5" style={{ color: "#808A95" }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer
        className="py-5 text-center text-xs"
        style={{
          borderTop: "1px solid rgba(0,92,255,0.08)",
          background: "#FFFFFF",
          color: "#808A95",
        }}
      >
        © {new Date().getFullYear()} 9 Expert Company Limited · Internal use
        only
      </footer>
    </div>
  );
}
