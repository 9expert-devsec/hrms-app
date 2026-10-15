"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canAccess } from "@/lib/rbac/access";
import {
  BarChart2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  Users,
  Clock,
  AlertTriangle,
  XCircle,
  CalendarDays,
  TrendingUp,
  Search,
} from "lucide-react";

/* ── design tokens ─────────────────────────────────── */
const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const LIME = "#D4F73F";
const SLATE = "#5E6A7E";
const ICE = "#F8FAFD";
const CARD = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,92,255,0.10)",
  borderRadius: "16px",
  boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
};

const INPUT_STYLE = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,92,255,0.15)",
  fontSize: 14,
  color: NAVY,
  background: "#FFFFFF",
  outline: "none",
};

export default function AttendanceReportPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [department, setDepartment] = useState("");
  const [report, setReport] = useState([]);
  const [workingDays, setWorkingDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  /* ── auth guard ──────────────────────── */
  // Registry check (src/lib/rbac); the middleware already enforces it.
  const allowed = canAccess(session?.user, "attendance_report");

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) { router.replace("/login"); return; }
    if (!allowed) router.replace("/403");
  }, [session, authStatus, router, allowed]);

  /* ── fetch report ────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/attendance/report?month=${month}&year=${year}`;
      if (department) url += `&department=${encodeURIComponent(department)}`;
      const res = await fetch(url, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`);
      setReport(j.data?.report || []);
      setWorkingDays(j.data?.workingDays || 0);
    } catch {
      setReport([]);
    } finally {
      setLoading(false);
    }
  }, [month, year, department]);

  useEffect(() => {
    if (authStatus === "authenticated" && allowed) load();
  }, [authStatus, allowed, load]);

  /* ── month navigation ────────────────── */
  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  /* ── filter ──────────────────────────── */
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return report;
    return report.filter((r) =>
      r.name?.toLowerCase().includes(kw) ||
      r.department?.toLowerCase().includes(kw) ||
      String(r.empAutoId || "").includes(kw),
    );
  }, [report, q]);

  /* ── departments from report ─────────── */
  const departments = useMemo(() => {
    const set = new Set(report.map((r) => r.department).filter(Boolean));
    return Array.from(set).sort();
  }, [report]);

  /* ── totals ──────────────────────────── */
  const totals = useMemo(() => {
    let present = 0, late = 0, absent = 0, leave = 0, wh = 0, lm = 0, ot = 0;
    for (const r of filtered) {
      present += r.presentDays || 0;
      late += r.lateDays || 0;
      absent += r.absentDays || 0;
      leave += r.leaveDays || 0;
      wh += r.totalWorkHours || 0;
      lm += r.totalLateMinutes || 0;
      ot += r.totalOTHours || 0;
    }
    return {
      present, late, absent, leave,
      wh: Math.round(wh * 100) / 100,
      lm,
      ot: Math.round(ot * 100) / 100,
    };
  }, [filtered]);

  /* ── export CSV ──────────────────────── */
  function exportCSV() {
    const headers = [
      "Employee ID", "Name", "Department",
      "Working Days", "Present", "Late", "Absent", "Leave",
      "Work Hours", "Late (min)", "OT Hours",
    ];
    const rows = filtered.map((r) => [
      r.empAutoId || "",
      r.name || "",
      r.department || "",
      r.totalDays ?? workingDays,
      r.presentDays || 0,
      r.lateDays || 0,
      r.absentDays || 0,
      r.leaveDays || 0,
      r.totalWorkHours || 0,
      r.totalLateMinutes || 0,
      r.totalOTHours || 0,
    ]);

    const bom = "\uFEFF";
    const csv = bom + [
      headers.join(","),
      ...rows.map((r) =>
        r.map((v) => {
          const s = String(v);
          return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── format month ────────────────────── */
  function fmtMonthYear() {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  }

  /* ── guard render ────────────────────── */
  if (authStatus === "loading" || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin" style={{ color: BLUE }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────── */}
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl grid place-items-center"
            style={{ background: "rgba(0,92,255,0.08)" }}
          >
            <BarChart2 size={20} style={{ color: BLUE }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>
              รายงานเวลาทำงาน
            </h1>
            <p className="text-sm" style={{ color: SLATE }}>
              สรุปข้อมูล Attendance รายเดือน
            </p>
          </div>
        </div>

        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 disabled:opacity-40"
          style={{ background: NAVY, color: LIME }}
        >
          <Download size={16} />
          Export CSV
        </button>
      </header>

      {/* ── Month Nav + Filters ────────────── */}
      <div className="flex flex-wrap items-center gap-3" style={{ ...CARD, padding: "16px" }}>
        {/* Month nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg transition-colors duration-150"
            style={{ color: NAVY, background: ICE }}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-bold min-w-[140px] text-center" style={{ color: NAVY }}>
            {fmtMonthYear()}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg transition-colors duration-150"
            style={{ color: NAVY, background: ICE }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Department filter */}
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          style={{ ...INPUT_STYLE, minWidth: 140 }}
        >
          <option value="">ทุกแผนก</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={15}
            style={{ color: SLATE, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อ..."
            style={{ ...INPUT_STYLE, width: "100%", paddingLeft: 36 }}
          />
        </div>

        <span className="text-xs" style={{ color: SLATE }}>
          วันทำงาน: {workingDays} วัน · พนักงาน: {filtered.length} คน
        </span>
      </div>

      {/* ── Summary Row ────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "มาทำงาน", value: totals.present, unit: "วัน", color: "#10B981", bg: "#D1FAE5" },
          { label: "มาสาย", value: totals.late, unit: "วัน", color: "#F59E0B", bg: "#FEF3C7" },
          { label: "ขาดงาน", value: totals.absent, unit: "วัน", color: "#EF4444", bg: "#FEE2E2" },
          { label: "ลา", value: totals.leave, unit: "วัน", color: "#3B82F6", bg: "#DBEAFE" },
          { label: "ชม.ทำงาน", value: totals.wh, unit: "ชม.", color: NAVY, bg: ICE },
          { label: "สายรวม", value: totals.lm, unit: "นาที", color: "#F59E0B", bg: "#FEF3C7" },
          { label: "OT", value: totals.ot, unit: "ชม.", color: BLUE, bg: "rgba(0,92,255,0.08)" },
        ].map((s) => (
          <div key={s.label} style={CARD} className="p-3 text-center">
            <p className="text-xs font-medium mb-1" style={{ color: SLATE }}>{s.label}</p>
            <p className="text-lg font-bold" style={{ color: s.color }}>
              {s.value} <span className="text-xs font-normal" style={{ color: SLATE }}>{s.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* ── Loading ────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin" style={{ color: BLUE }} />
        </div>
      )}

      {/* ── Report Table ───────────────────── */}
      {!loading && (
        <div style={CARD} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr style={{ background: ICE, borderBottom: "1px solid rgba(0,92,255,0.08)" }}>
                  {[
                    "พนักงาน", "แผนก", "วันทำงาน", "มาทำงาน", "มาสาย",
                    "ขาดงาน", "ลา", "ชม.ทำงาน", "สาย (นาที)", "OT (ชม.)",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 font-semibold whitespace-nowrap"
                      style={{ color: NAVY }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-12" style={{ color: SLATE }}>
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr
                    key={r.employeeId}
                    style={{ borderBottom: "1px solid rgba(0,92,255,0.06)" }}
                    className="transition-colors duration-100"
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,92,255,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-semibold" style={{ color: NAVY }}>{r.name}</p>
                      {r.empAutoId && (
                        <p className="text-xs" style={{ color: SLATE }}>{r.empAutoId}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: NAVY }}>{r.department || "-"}</td>
                    <td className="px-4 py-2.5" style={{ color: NAVY }}>{r.totalDays ?? workingDays}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold" style={{ color: "#10B981" }}>
                        {r.presentDays || 0}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span style={{ color: r.lateDays > 0 ? "#F59E0B" : SLATE }}>
                        {r.lateDays || 0}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span style={{ color: r.absentDays > 0 ? "#EF4444" : SLATE }}>
                        {r.absentDays || 0}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span style={{ color: r.leaveDays > 0 ? "#3B82F6" : SLATE }}>
                        {r.leaveDays || 0}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: NAVY }}>
                      {r.totalWorkHours || 0}
                    </td>
                    <td className="px-4 py-2.5">
                      <span style={{ color: r.totalLateMinutes > 0 ? "#F59E0B" : SLATE }}>
                        {r.totalLateMinutes || 0}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold" style={{ color: r.totalOTHours > 0 ? BLUE : SLATE }}>
                        {r.totalOTHours || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Totals row */}
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ background: ICE, borderTop: "2px solid rgba(0,92,255,0.12)" }}>
                    <td className="px-4 py-2.5 font-bold" style={{ color: NAVY }} colSpan={2}>
                      รวม ({filtered.length} คน)
                    </td>
                    <td className="px-4 py-2.5 font-bold" style={{ color: NAVY }}>{workingDays}</td>
                    <td className="px-4 py-2.5 font-bold" style={{ color: "#10B981" }}>{totals.present}</td>
                    <td className="px-4 py-2.5 font-bold" style={{ color: "#F59E0B" }}>{totals.late}</td>
                    <td className="px-4 py-2.5 font-bold" style={{ color: "#EF4444" }}>{totals.absent}</td>
                    <td className="px-4 py-2.5 font-bold" style={{ color: "#3B82F6" }}>{totals.leave}</td>
                    <td className="px-4 py-2.5 font-bold" style={{ color: NAVY }}>{totals.wh}</td>
                    <td className="px-4 py-2.5 font-bold" style={{ color: "#F59E0B" }}>{totals.lm}</td>
                    <td className="px-4 py-2.5 font-bold" style={{ color: BLUE }}>{totals.ot}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
