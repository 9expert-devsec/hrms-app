"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  Loader2,
  X,
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

const TYPE_COLORS = {
  sick:     { bg: "#FEE2E2", color: "#991B1B" },
  annual:   { bg: "#DBEAFE", color: "#1E40AF" },
  personal: { bg: "#FEF3C7", color: "#92400E" },
  maternity:{ bg: "#E0E7FF", color: "#3730A3" },
  paternity:{ bg: "#E0E7FF", color: "#3730A3" },
  other:    { bg: "#F1F5F9", color: "#475569" },
};

const TYPE_LABELS = {
  sick: "ลาป่วย",
  annual: "ลาพักร้อน",
  personal: "ลากิจ",
  maternity: "ลาคลอด",
  paternity: "ลาดูแลบุตร",
  other: "อื่น ๆ",
};

const STATUS_LABELS = {
  hod_approved: "รอ HR อนุมัติ",
  approved: "อนุมัติแล้ว",
};

const DAY_NAMES = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
}

function abbreviateName(name) {
  if (!name) return "?";
  const parts = name.split(" ");
  if (parts.length >= 2) return `${parts[0].charAt(0)}.${parts[1].charAt(0)}.`;
  return name.substring(0, 3);
}

export default function LeaveCalendarPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [popup, setPopup] = useState(null); // { item, x, y }
  const popupRef = useRef(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/leave/calendar?month=${month}&year=${year}`);
        const j = await res.json();
        setItems(j.ok ? j.items : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [month, year]);

  // Close popup on outside click
  useEffect(() => {
    function handleClick(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) setPopup(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* Filtered items */
  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (deptFilter && i.department !== deptFilter) return false;
      if (typeFilter && i.leaveType !== typeFilter) return false;
      return true;
    });
  }, [items, deptFilter, typeFilter]);

  /* Departments for filter */
  const departments = useMemo(() => {
    const s = new Set(items.map((i) => i.department).filter(Boolean));
    return [...s].sort();
  }, [items]);

  /* Build calendar grid */
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells = [];

    // Padding for first week
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return cells;
  }, [month, year]);

  /* Map day → leaves */
  const dayLeavesMap = useMemo(() => {
    const map = {};
    filtered.forEach((item) => {
      const start = new Date(item.startDate);
      const end = new Date(item.endDate);
      const mStart = new Date(year, month - 1, 1);
      const mEnd = new Date(year, month, 0, 23, 59, 59);

      const from = start < mStart ? mStart : start;
      const to = end > mEnd ? mEnd : end;

      const cur = new Date(from);
      while (cur <= to) {
        const d = cur.getDate();
        if (!map[d]) map[d] = [];
        map[d].push(item);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [filtered, month, year]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

  const isToday = (d) =>
    d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }} className="space-y-6">
      {/* ── Header ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "rgba(0,92,255,0.08)", color: BLUE }}
        >
          <Calendar size={22} strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{ color: NAVY, fontSize: 22, fontWeight: 700 }}>Leave Calendar</h1>
          <p style={{ color: SLATE, fontSize: 13 }}>View team leave schedule</p>
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────── */}
      <div style={CARD} className="flex flex-wrap items-center gap-3 p-4">
        <Filter size={16} style={{ color: SLATE }} />

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,92,255,0.15)",
            fontSize: 13,
            color: NAVY,
            background: ICE,
          }}
        >
          <option value="">ทุกแผนก</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,92,255,0.15)",
            fontSize: 13,
            color: NAVY,
            background: ICE,
          }}
        >
          <option value="">ทุกประเภท</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {(deptFilter || typeFilter) && (
          <button
            onClick={() => { setDeptFilter(""); setTypeFilter(""); }}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5"
            style={{ color: BLUE, fontSize: 12, fontWeight: 500 }}
          >
            <X size={14} /> ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* ── Month Navigation ──────────────────── */}
      <div style={CARD} className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: ICE, color: NAVY }}
          >
            <ChevronLeft size={20} />
          </button>
          <span style={{ color: NAVY, fontSize: 18, fontWeight: 700 }}>
            {MONTHS_TH[month - 1]} {year + 543}
          </span>
          <button
            onClick={nextMonth}
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: ICE, color: NAVY }}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: BLUE }} />
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* Day headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 2,
                marginBottom: 4,
              }}
            >
              {DAY_NAMES.map((d, i) => (
                <div
                  key={i}
                  style={{
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    color: i === 0 || i === 6 ? "#991B1B" : SLATE,
                    padding: "8px 0",
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 2,
              }}
            >
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`e-${idx}`} />;

                const leaves = dayLeavesMap[day] || [];
                const dayOfWeek = new Date(year, month - 1, day).getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                return (
                  <div
                    key={day}
                    style={{
                      minHeight: 80,
                      padding: 4,
                      borderRadius: 8,
                      background: isToday(day) ? `${BLUE}08` : isWeekend ? "#F9FAFB" : "#FFFFFF",
                      border: isToday(day) ? `2px solid ${BLUE}` : "1px solid #F1F5F9",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: isToday(day) ? 700 : 500,
                        color: isToday(day) ? BLUE : isWeekend ? "#991B1B" : NAVY,
                        marginBottom: 2,
                        textAlign: "right",
                        padding: "0 2px",
                      }}
                    >
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {leaves.slice(0, 3).map((item, i) => {
                        const tc = TYPE_COLORS[item.leaveType] || TYPE_COLORS.other;
                        return (
                          <div
                            key={`${item.employeeId}-${item.leaveType}-${i}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPopup({ item, x: e.clientX, y: e.clientY });
                            }}
                            style={{
                              background: tc.bg,
                              color: tc.color,
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "1px 4px",
                              borderRadius: 4,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {abbreviateName(item.employeeName)}
                          </div>
                        );
                      })}
                      {leaves.length > 3 && (
                        <div style={{ fontSize: 10, color: SLATE, padding: "0 4px" }}>
                          +{leaves.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Popup */}
            {popup && (
              <div
                ref={popupRef}
                style={{
                  position: "fixed",
                  left: Math.min(popup.x, window.innerWidth - 260),
                  top: Math.min(popup.y + 8, window.innerHeight - 180),
                  zIndex: 50,
                  width: 240,
                  background: "#FFFFFF",
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: "0 8px 32px rgba(13,27,42,0.18)",
                  border: "1px solid rgba(0,92,255,0.10)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: NAVY, fontSize: 14, fontWeight: 700 }}>
                    {popup.item.employeeName}
                  </span>
                  <button
                    onClick={() => setPopup(null)}
                    style={{ color: SLATE, cursor: "pointer", background: "none", border: "none" }}
                  >
                    <X size={14} />
                  </button>
                </div>
                {popup.item.department && (
                  <div style={{ color: SLATE, fontSize: 12, marginBottom: 8 }}>
                    {popup.item.department}
                  </div>
                )}
                <div className="space-y-1" style={{ fontSize: 13 }}>
                  <div style={{ color: NAVY }}>
                    <span style={{ fontWeight: 600 }}>ประเภท:</span>{" "}
                    {TYPE_LABELS[popup.item.leaveType] || popup.item.leaveType}
                  </div>
                  <div style={{ color: NAVY }}>
                    <span style={{ fontWeight: 600 }}>วันที่:</span>{" "}
                    {fmtDate(popup.item.startDate)} - {fmtDate(popup.item.endDate)}
                  </div>
                  <div style={{ color: NAVY }}>
                    <span style={{ fontWeight: 600 }}>จำนวน:</span> {popup.item.totalDays} วัน
                  </div>
                  <div style={{ color: NAVY }}>
                    <span style={{ fontWeight: 600 }}>สถานะ:</span>{" "}
                    {STATUS_LABELS[popup.item.status] || popup.item.status}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
