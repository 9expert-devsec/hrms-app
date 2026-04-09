"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  FileText,
  TrendingUp,
  Coffee,
} from "lucide-react";

/* ── design tokens ─────────────────────────────────── */
const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const SLATE = "#808A95";
const ICE = "#F8FAFD";
const CARD = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,92,255,0.10)",
  borderRadius: "16px",
  boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
};

const STATUS_DOT = {
  present: "#10B981",
  late: "#F59E0B",
  absent: "#EF4444",
  leave: "#3B82F6",
  holiday: "#8B5CF6",
  weekend: "#D1D5DB",
};

const STATUS_LABEL = {
  present: "มาทำงาน",
  late: "มาสาย",
  absent: "ขาดงาน",
  leave: "ลา",
  holiday: "วันหยุด",
  weekend: "วันหยุด",
};

const STATUS_BADGE = {
  present: { bg: "#D1FAE5", color: "#065F46" },
  late: { bg: "#FEF3C7", color: "#92400E" },
  absent: { bg: "#FEE2E2", color: "#991B1B" },
  leave: { bg: "#DBEAFE", color: "#1E40AF" },
  holiday: { bg: "#EDE9FE", color: "#5B21B6" },
  weekend: { bg: "#F1F5F9", color: "#475569" },
};

const WEEKDAY_HEADERS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/* ── helpers ───────────────────────────────────────── */
function fmtTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function fmtMonthYear(year, month) {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

export default function MyAttendancePage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  /* ── auth guard ──────────────────────── */
  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) router.replace("/login");
  }, [session, authStatus, router]);

  /* ── fetch records ───────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/attendance/records?month=${month}&year=${year}`,
        { cache: "no-store" },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`);
      setDays(j.data?.days || []);
    } catch {
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    if (authStatus === "authenticated") load();
  }, [authStatus, load]);

  /* ── month navigation ────────────────── */
  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelected(null);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelected(null);
  }

  /* ── summary stats ───────────────────── */
  const stats = useMemo(() => {
    let present = 0, late = 0, absent = 0, otHours = 0;
    for (const d of days) {
      if (d.status === "present") present++;
      else if (d.status === "late") { present++; late++; }
      else if (d.status === "absent") absent++;
      if (d.otHours) otHours += d.otHours;
    }
    return { present, late, absent, otHours: Math.round(otHours * 100) / 100 };
  }, [days]);

  /* ── build calendar grid ─────────────── */
  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const startDow = firstDay.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const dayMap = {};
    for (const d of days) dayMap[d.date] = d;

    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push({ type: "pad" });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ type: "day", day: d, date: dateStr, record: dayMap[dateStr] || null });
    }
    return cells;
  }, [days, year, month]);

  /* ── table rows ──────────────────────── */
  const tableRows = useMemo(() => {
    return days
      .filter((d) => d.status && !["weekend", "holiday"].includes(d.status))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [days]);

  /* ── guard render ────────────────────── */
  if (authStatus === "loading" || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin" style={{ color: BLUE }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────── */}
      <header className="flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-xl grid place-items-center"
          style={{ background: "rgba(0,92,255,0.08)" }}
        >
          <CalendarDays size={18} style={{ color: BLUE }} />
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: NAVY }}>
            เวลาทำงานของฉัน
          </h1>
          <p className="text-xs" style={{ color: SLATE }}>
            สรุปเวลาเข้า-ออกงานรายเดือน
          </p>
        </div>
      </header>

      {/* ── Month Navigation ───────────────── */}
      <div
        className="flex items-center justify-between"
        style={{ ...CARD, padding: "8px 16px", borderRadius: 12 }}
      >
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg transition-colors duration-150"
          style={{ color: NAVY, background: ICE }}
        >
          <ChevronLeft size={16} />
        </button>
        <h2 className="text-sm font-bold" style={{ color: NAVY }}>
          {fmtMonthYear(year, month - 1)}
        </h2>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg transition-colors duration-150"
          style={{ color: NAVY, background: ICE }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Summary Cards ──────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "ทำงาน", value: stats.present, unit: "วัน", color: "#10B981", bg: "#D1FAE5", Icon: CheckCircle2 },
          { label: "มาสาย", value: stats.late, unit: "วัน", color: "#F59E0B", bg: "#FEF3C7", Icon: AlertTriangle },
          { label: "ขาดงาน", value: stats.absent, unit: "วัน", color: "#EF4444", bg: "#FEE2E2", Icon: X },
          { label: "OT", value: stats.otHours, unit: "ชม.", color: BLUE, bg: "rgba(0,92,255,0.08)", Icon: TrendingUp },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "#FFFFFF", border: "1px solid rgba(0,92,255,0.10)" }}
          >
            <div
              className="h-6 w-6 rounded-md grid place-items-center shrink-0"
              style={{ background: s.bg }}
            >
              <s.Icon size={12} style={{ color: s.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold leading-none" style={{ color: NAVY }}>
                {s.value}
                <span className="text-xs font-normal ml-0.5" style={{ color: SLATE }}>{s.unit}</span>
              </p>
              <p className="text-[10px]" style={{ color: SLATE }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Loading ────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-24">
          <Loader2 size={22} className="animate-spin" style={{ color: BLUE }} />
        </div>
      )}

      {/* ── Calendar Grid ──────────────────── */}
      {!loading && (
        <div
          style={{ ...CARD, borderRadius: 12, padding: 0, overflow: "hidden" }}
        >
          {/* Weekday headers */}
          <div
            className="grid grid-cols-7"
            style={{
              background: ICE,
              borderBottom: "1px solid rgba(0,92,255,0.06)",
              position: "sticky",
              top: 0,
              zIndex: 2,
            }}
          >
            {WEEKDAY_HEADERS.map((w, i) => (
              <div
                key={w}
                className="text-center py-2"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: i === 0 || i === 6 ? SLATE : NAVY,
                  textTransform: "uppercase",
                }}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarCells.map((cell, idx) => {
              if (cell.type === "pad") {
                return (
                  <div
                    key={`pad-${idx}`}
                    style={{
                      minHeight: 64,
                      borderRight: "0.5px solid rgba(0,92,255,0.06)",
                      borderBottom: "0.5px solid rgba(0,92,255,0.06)",
                    }}
                  />
                );
              }

              const rec = cell.record;
              const status = rec?.status || null;
              const dotColor = status ? STATUS_DOT[status] || SLATE : "transparent";
              const isToday =
                cell.day === today.getDate() &&
                month === today.getMonth() + 1 &&
                year === today.getFullYear();
              const isWeekendOrHoliday = status === "weekend" || status === "holiday";
              const clockIn = rec?.clockIn ? fmtTime(rec.clockIn) : "";

              return (
                <button
                  key={cell.date}
                  onClick={() => {
                    if (rec) setSelected(rec);
                    else if (status === "holiday" || status === "weekend") {
                      // Allow clicking holidays/weekends from the days array
                      const dayData = days.find((d) => d.date === cell.date);
                      if (dayData) setSelected(dayData);
                    }
                  }}
                  className="flex flex-col items-center gap-0.5 transition-colors duration-100"
                  style={{
                    minHeight: 64,
                    maxHeight: 72,
                    padding: "6px 4px",
                    borderRight: "0.5px solid rgba(0,92,255,0.06)",
                    borderBottom: "0.5px solid rgba(0,92,255,0.06)",
                    background: isToday ? "rgba(0,92,255,0.05)" : "transparent",
                    cursor: rec || status ? "pointer" : "default",
                  }}
                  onMouseEnter={(e) => {
                    if (rec || status) e.currentTarget.style.background = "rgba(0,92,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isToday ? "rgba(0,92,255,0.05)" : "transparent";
                  }}
                >
                  {/* Date number */}
                  <span
                    className="leading-none"
                    style={{
                      fontSize: 13,
                      fontWeight: isToday ? 700 : 500,
                      color: isWeekendOrHoliday ? SLATE : NAVY,
                      ...(isToday
                        ? {
                            background: BLUE,
                            color: "#FFFFFF",
                            borderRadius: "50%",
                            width: 22,
                            height: 22,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }
                        : {}),
                    }}
                  >
                    {cell.day}
                  </span>

                  {/* Status dot */}
                  {status && (
                    <span
                      className="rounded-full"
                      style={{ width: 6, height: 6, background: dotColor }}
                    />
                  )}

                  {/* Clock-in time (only if present) */}
                  {clockIn && (
                    <span style={{ fontSize: 10, color: SLATE, lineHeight: 1 }}>
                      {clockIn}
                    </span>
                  )}

                  {/* Holiday name abbreviation */}
                  {status === "holiday" && rec?.holidayName && (
                    <span
                      style={{
                        fontSize: 9,
                        color: "#8B5CF6",
                        lineHeight: 1,
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {rec.holidayName.length > 6
                        ? rec.holidayName.slice(0, 6) + "…"
                        : rec.holidayName}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div
            className="flex flex-wrap gap-4 px-3 py-2"
            style={{ borderTop: "1px solid rgba(0,92,255,0.06)" }}
          >
            {Object.entries(STATUS_DOT).map(([key, color]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="rounded-full" style={{ width: 8, height: 8, background: color }} />
                <span style={{ fontSize: 11, color: SLATE }}>{STATUS_LABEL[key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Monthly Table ──────────────────── */}
      {!loading && tableRows.length > 0 && (
        <div style={CARD} className="overflow-hidden">
          <div className="px-4 py-2.5" style={{ borderBottom: "1px solid rgba(0,92,255,0.08)" }}>
            <h3 className="text-xs font-bold" style={{ color: NAVY }}>
              รายละเอียดเวลาทำงาน
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr style={{ background: ICE }}>
                  {["วันที่", "Clock In", "Clock Out", "ชม.", "สาย", "สถานะ", "OT"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-semibold" style={{ color: NAVY }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => {
                  const badge = STATUS_BADGE[row.status];
                  const dayNum = new Date(row.date).getDate();
                  const dayName = new Date(row.date).toLocaleDateString("th-TH", { weekday: "short" });

                  return (
                    <tr
                      key={row.date}
                      className="transition-colors duration-100 cursor-pointer"
                      style={{ borderBottom: "1px solid rgba(0,92,255,0.06)" }}
                      onClick={() => setSelected(row)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,92,255,0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td className="px-3 py-2 font-medium" style={{ color: NAVY }}>{dayNum} {dayName}</td>
                      <td className="px-3 py-2" style={{ color: NAVY }}>{fmtTime(row.clockIn) || "-"}</td>
                      <td className="px-3 py-2" style={{ color: NAVY }}>{fmtTime(row.clockOut) || "-"}</td>
                      <td className="px-3 py-2" style={{ color: NAVY }}>{row.workHours ?? "-"}</td>
                      <td className="px-3 py-2" style={{ color: row.lateMinutes > 0 ? "#92400E" : SLATE }}>
                        {row.lateMinutes > 0 ? `${row.lateMinutes}` : "-"}
                      </td>
                      <td className="px-3 py-2">
                        {badge && (
                          <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: badge.bg, color: badge.color }}>
                            {STATUS_LABEL[row.status]}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2" style={{ color: row.otHours > 0 ? BLUE : SLATE }}>
                        {row.otHours > 0 ? row.otHours : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Day Detail Modal ───────────────── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13,27,42,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div
            className="w-full max-w-sm overflow-y-auto"
            style={{ background: "#FFFFFF", borderRadius: 16, boxShadow: "0 16px 48px rgba(13,27,42,0.2)", maxHeight: "90vh" }}
          >
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: "1px solid rgba(0,92,255,0.08)" }}
            >
              <h3 className="text-sm font-bold" style={{ color: NAVY }}>
                {selected.date
                  ? new Date(selected.date).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })
                  : "-"}
              </h3>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg" style={{ color: SLATE }}>
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {selected.status && STATUS_BADGE[selected.status] && (
                <span
                  className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: STATUS_BADGE[selected.status].bg, color: STATUS_BADGE[selected.status].color }}
                >
                  {STATUS_LABEL[selected.status]}
                </span>
              )}

              {/* Holiday info */}
              {selected.status === "holiday" && selected.holidayName && (
                <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "#EDE9FE", color: "#5B21B6" }}>
                  {selected.holidayName}
                </div>
              )}

              {/* Attendance details (only for work days) */}
              {selected.clockIn !== undefined && (
                <div className="space-y-2">
                  {[
                    { label: "Clock In", value: fmtTime(selected.clockIn) || "-", icon: Clock },
                    { label: "Clock Out", value: fmtTime(selected.clockOut) || "-", icon: Clock },
                    { label: "ชั่วโมงทำงาน", value: selected.workHours != null ? `${selected.workHours} ชม.` : "-", icon: TrendingUp },
                    { label: "มาสาย", value: selected.lateMinutes > 0 ? `${selected.lateMinutes} นาที` : "-", icon: AlertTriangle },
                    { label: "OT", value: selected.otHours > 0 ? `${selected.otHours} ชม.` : "-", icon: Coffee },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between py-1.5 px-3 rounded-lg"
                      style={{ background: ICE }}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon size={13} style={{ color: SLATE }} />
                        <span className="text-xs" style={{ color: SLATE }}>{item.label}</span>
                      </div>
                      <span className="text-xs font-semibold" style={{ color: NAVY }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {selected.note && (
                <div className="flex items-start gap-2 pt-1" style={{ color: SLATE }}>
                  <FileText size={13} className="mt-0.5 shrink-0" />
                  <span className="text-xs">{selected.note}</span>
                </div>
              )}

              {selected.status === "leave" && selected.leaveType && (
                <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "#DBEAFE", color: "#1E40AF" }}>
                  ประเภทลา: {selected.leaveType}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
