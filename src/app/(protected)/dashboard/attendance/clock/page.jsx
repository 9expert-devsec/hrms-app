"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Timer,
  LogIn,
  LogOut,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Coffee,
  CalendarDays,
} from "lucide-react";

/* ── design tokens ─────────────────────────────────── */
const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const LIME = "#D4F73F";
const SLATE = "#808A95";
const ICE = "#F8FAFD";
const CARD = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,92,255,0.10)",
  borderRadius: "16px",
  boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
};

const INPUT_STYLE = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,92,255,0.15)",
  fontSize: 14,
  color: NAVY,
  background: "#FFFFFF",
  outline: "none",
};

/* ── helpers ───────────────────────────────────────── */
function fmtTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateThai(d) {
  return new Date(d).toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function diffHoursMinutes(from, to) {
  const ms = new Date(to) - new Date(from);
  if (ms <= 0) return { h: 0, m: 0 };
  const totalMin = Math.floor(ms / 60000);
  return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
}

/* ── Status badges ─────────────────────────────────── */
const STATUS = {
  present:  { bg: "#D1FAE5", color: "#065F46", label: "มาทำงาน" },
  late:     { bg: "#FEF3C7", color: "#92400E", label: "มาสาย" },
  absent:   { bg: "#FEE2E2", color: "#991B1B", label: "ขาดงาน" },
  leave:    { bg: "#DBEAFE", color: "#1E40AF", label: "ลา" },
  holiday:  { bg: "#EDE9FE", color: "#5B21B6", label: "วันหยุด" },
  weekend:  { bg: "#F1F5F9", color: "#475569", label: "วันหยุด" },
};

export default function ClockPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [now, setNow] = useState(new Date());
  const [record, setRecord] = useState(null); // today's attendance record
  const [shift, setShift] = useState(null);   // current shift assignment
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");

  /* ── live clock ──────────────────────── */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ── auth guard ──────────────────────── */
  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) router.replace("/login");
  }, [session, authStatus, router]);

  /* ── fetch today's data ──────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();

      const [recRes, shiftRes] = await Promise.all([
        fetch(`/api/attendance/records?month=${month}&year=${year}`, { cache: "no-store" }),
        fetch("/api/attendance/employee-shift", { cache: "no-store" }),
      ]);

      const recJ = await recRes.json().catch(() => ({}));
      const shiftJ = await shiftRes.json().catch(() => ({}));

      // Find today's record
      const todayStr = today.toISOString().slice(0, 10);
      const days = recJ.data?.days || [];
      const todayRec = days.find((d) => d.date === todayStr);
      setRecord(todayRec?.clockIn ? todayRec : null);

      // Get shift info
      const assignments = shiftJ.data || [];
      const myAssign = Array.isArray(assignments) ? assignments[0] : assignments;
      if (myAssign?.shiftId && typeof myAssign.shiftId === "object") {
        setShift(myAssign.shiftId);
      } else {
        setShift(null);
      }
    } catch {
      // silent — will show "no data" state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") load();
  }, [authStatus, load]);

  /* ── clock action ────────────────────── */
  async function handleClock(action) {
    setSubmitting(true);
    try {
      const body = { action };
      if (note.trim()) body.note = note.trim();

      const res = await fetch("/api/attendance/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || j?.error || "บันทึกไม่สำเร็จ");

      setNote("");
      load();
    } catch (err) {
      alert(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── derived state ───────────────────── */
  const notClockedIn = !record || !record.clockIn;
  const clockedIn = record?.clockIn && !record?.clockOut;
  const clockedOut = record?.clockIn && record?.clockOut;

  // Live work duration (only when clocked in)
  const liveDuration = clockedIn ? diffHoursMinutes(record.clockIn, now) : null;

  /* ── guard render ────────────────────── */
  if (authStatus === "loading" || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin" style={{ color: BLUE }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* ── Header ─────────────────────────── */}
      <header className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-xl grid place-items-center"
          style={{ background: "rgba(0,92,255,0.08)" }}
        >
          <Timer size={20} style={{ color: BLUE }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: NAVY }}>
            บันทึกเวลาทำงาน
          </h1>
          <p className="text-sm" style={{ color: SLATE }}>
            Clock In / Clock Out ประจำวัน
          </p>
        </div>
      </header>

      {/* ── Current Status Card ────────────── */}
      <div style={CARD} className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Date */}
          <div>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              {fmtDateThai(now)}
            </p>
            {shift && (
              <p className="text-xs mt-1" style={{ color: SLATE }}>
                <Clock size={12} className="inline mr-1" />
                กะ: {shift.name} ({shift.startTime} - {shift.endTime})
              </p>
            )}
            {!shift && !loading && (
              <p className="text-xs mt-1" style={{ color: SLATE }}>
                ยังไม่ได้กำหนดกะ
              </p>
            )}
          </div>

          {/* Live clock */}
          <div className="text-right">
            <p
              className="text-3xl font-bold tabular-nums"
              style={{ color: NAVY, letterSpacing: "0.02em" }}
            >
              {now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="text-xs" style={{ color: SLATE }}>
              เวลาปัจจุบัน
            </p>
          </div>
        </div>
      </div>

      {/* ── Loading ────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={28} className="animate-spin" style={{ color: BLUE }} />
        </div>
      )}

      {/* ── STATE A: Not Clocked In ─────────── */}
      {!loading && notClockedIn && (
        <div style={CARD} className="p-6 text-center">
          <div className="mb-4">
            <div
              className="h-16 w-16 rounded-2xl grid place-items-center mx-auto mb-3"
              style={{ background: "rgba(212,247,63,0.15)" }}
            >
              <LogIn size={32} style={{ color: NAVY }} />
            </div>
            <p className="text-sm" style={{ color: SLATE }}>
              คุณยังไม่ได้ Clock In วันนี้
            </p>
            {shift && (
              <p className="text-xs mt-1" style={{ color: SLATE }}>
                กะงานของคุณ: {shift.startTime} - {shift.endTime}
              </p>
            )}
          </div>

          {/* Note input */}
          <div className="max-w-sm mx-auto mb-4">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="หมายเหตุ (optional)"
              style={INPUT_STYLE}
            />
          </div>

          <button
            onClick={() => handleClock("in")}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-3 w-full max-w-sm rounded-2xl font-bold text-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
            style={{
              background: LIME,
              color: NAVY,
              padding: "20px 24px",
            }}
          >
            {submitting ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <LogIn size={22} />
            )}
            Clock In
          </button>
        </div>
      )}

      {/* ── STATE B: Clocked In, Not Out ───── */}
      {!loading && clockedIn && (
        <div style={CARD} className="p-6 text-center">
          {/* Clock in badge */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
              style={{ background: "#D1FAE5", color: "#065F46" }}
            >
              <CheckCircle2 size={14} />
              Clock In แล้วเมื่อ {fmtTime(record.clockIn)}
            </span>
            {record.lateMinutes > 0 && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
                style={{ background: "#FEF3C7", color: "#92400E" }}
              >
                <AlertTriangle size={14} />
                มาสาย {record.lateMinutes} นาที
              </span>
            )}
          </div>

          {/* Live work timer */}
          {liveDuration && (
            <div className="mb-5">
              <p className="text-xs mb-1" style={{ color: SLATE }}>
                ทำงานมาแล้ว
              </p>
              <p
                className="text-4xl font-bold tabular-nums"
                style={{ color: NAVY }}
              >
                {String(liveDuration.h).padStart(2, "0")}
                <span style={{ color: BLUE }}>:</span>
                {String(liveDuration.m).padStart(2, "0")}
              </p>
              <p className="text-xs mt-1" style={{ color: SLATE }}>
                ชั่วโมง : นาที
              </p>
            </div>
          )}

          {/* Note input */}
          <div className="max-w-sm mx-auto mb-4">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="หมายเหตุ (optional)"
              style={INPUT_STYLE}
            />
          </div>

          <button
            onClick={() => handleClock("out")}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-3 w-full max-w-sm rounded-2xl font-bold text-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
            style={{
              background: BLUE,
              color: "#FFFFFF",
              padding: "20px 24px",
            }}
          >
            {submitting ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <LogOut size={22} />
            )}
            Clock Out
          </button>
        </div>
      )}

      {/* ── STATE C: Clocked Out ───────────── */}
      {!loading && clockedOut && (
        <div style={CARD} className="p-6">
          {/* Success header */}
          <div className="text-center mb-5">
            <div
              className="h-14 w-14 rounded-2xl grid place-items-center mx-auto mb-2"
              style={{ background: "#D1FAE5" }}
            >
              <CheckCircle2 size={28} style={{ color: "#065F46" }} />
            </div>
            <p className="font-bold" style={{ color: NAVY }}>
              บันทึกเรียบร้อยแล้ว
            </p>
          </div>

          {/* Summary grid */}
          <div
            className="grid grid-cols-2 gap-4 p-4 rounded-xl"
            style={{ background: ICE }}
          >
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: SLATE }}>
                Clock In
              </p>
              <p className="text-base font-bold" style={{ color: NAVY }}>
                {fmtTime(record.clockIn)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: SLATE }}>
                Clock Out
              </p>
              <p className="text-base font-bold" style={{ color: NAVY }}>
                {fmtTime(record.clockOut)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: SLATE }}>
                ชั่วโมงทำงาน
              </p>
              <p className="text-base font-bold" style={{ color: NAVY }}>
                {record.workHours != null ? `${record.workHours} ชม.` : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: SLATE }}>
                มาสาย
              </p>
              <p className="text-base font-bold" style={{ color: record.lateMinutes > 0 ? "#92400E" : NAVY }}>
                {record.lateMinutes > 0 ? `${record.lateMinutes} นาที` : "-"}
              </p>
            </div>
          </div>

          {/* Status badge */}
          {record.status && STATUS[record.status] && (
            <div className="mt-4 text-center">
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  background: STATUS[record.status].bg,
                  color: STATUS[record.status].color,
                }}
              >
                {STATUS[record.status].label}
              </span>
            </div>
          )}

          {/* Note */}
          {record.note && (
            <div className="mt-4 text-sm" style={{ color: SLATE }}>
              <FileText size={13} className="inline mr-1" />
              {record.note}
            </div>
          )}
        </div>
      )}

      {/* ── Quick OT entry ─────────────────── */}
      {!loading && clockedOut && (
        <div
          style={CARD}
          className="p-4 flex items-center justify-between cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
          onClick={() => router.push("/dashboard/attendance/ot")}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-xl grid place-items-center"
              style={{ background: "rgba(0,92,255,0.08)" }}
            >
              <Coffee size={18} style={{ color: BLUE }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: NAVY }}>
                แจ้ง OT วันนี้
              </p>
              <p className="text-xs" style={{ color: SLATE }}>
                ยื่นคำขอทำงานล่วงเวลา
              </p>
            </div>
          </div>
          <span className="text-sm font-medium" style={{ color: BLUE }}>→</span>
        </div>
      )}

      {/* ── Link to my-attendance ──────────── */}
      <div
        style={CARD}
        className="p-4 flex items-center justify-between cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
        onClick={() => router.push("/dashboard/attendance/my-attendance")}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl grid place-items-center"
            style={{ background: "rgba(0,92,255,0.08)" }}
          >
            <CalendarDays size={18} style={{ color: BLUE }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              เวลาทำงานของฉัน
            </p>
            <p className="text-xs" style={{ color: SLATE }}>
              ดูสรุปประจำเดือน
            </p>
          </div>
        </div>
        <span className="text-sm font-medium" style={{ color: BLUE }}>→</span>
      </div>
    </div>
  );
}
