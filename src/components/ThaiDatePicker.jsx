"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { thaiDateShort } from "@/lib/leave/format";

const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const SLATE = "#5E6A7E";
const MUTED = "#8592A6";
const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
/** Today's Bangkok date key. */
const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

/**
 * A date field that shows the Thai Buddhist-era date in the field itself
 * ("พฤ. 3 ธ.ค. 2569"). `value` / onChange use date-only "YYYY-MM-DD" strings
 * (Bangkok calendar date). `min` / `max` limit the pickable days.
 */
export default function ThaiDatePicker({ id, value, onChange, min, max, placeholder = "เลือกวันที่", className = "", testid, invalid = false }) {
  const [open, setOpen] = useState(false);
  const start = value || min || todayKey();
  const [view, setView] = useState(() => ({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) }));
  const wrap = useRef(null);
  const gridId = useId();

  // Re-centre on the value each time it opens.
  useEffect(() => {
    if (!open) return;
    const s = value || min || todayKey();
    setView({ y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)) });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shift = (n) =>
    setView(({ y, m }) => {
      const t = y * 12 + (m - 1) + n;
      return { y: Math.floor(t / 12), m: (t % 12) + 1 };
    });

  const first = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const today = todayKey();
  const disabled = (k) => (min && k < min) || (max && k > max);

  return (
    <div ref={wrap} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid={testid}
        data-value={value || ""}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 text-left text-[14px] outline-none focus:ring-2 focus:ring-[#005CFF]/30 ${className}`}
        style={{ borderColor: invalid ? "#FCA5A5" : "#D6E0F0", color: value ? NAVY : MUTED }}
      >
        <span className="truncate">{value ? thaiDateShort(value) : placeholder}</span>
        <CalendarDays size={16} style={{ color: SLATE }} aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="เลือกวันที่"
          className="absolute left-0 z-40 mt-1 w-[288px] rounded-2xl bg-white p-3"
          style={{ border: "1px solid #E3EAF5", boxShadow: "0 12px 32px rgba(13,27,42,0.16)" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} aria-label="เดือนก่อนหน้า" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[#F5F8FF]">
              <ChevronLeft size={18} style={{ color: NAVY }} />
            </button>
            <p className="text-[14px] font-bold" style={{ color: NAVY }} id={gridId}>
              {MONTHS[view.m - 1]} {view.y + 543}
            </p>
            <button type="button" onClick={() => shift(1)} aria-label="เดือนถัดไป" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[#F5F8FF]">
              <ChevronRight size={18} style={{ color: NAVY }} />
            </button>
          </div>
          <div role="grid" aria-labelledby={gridId} className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className="py-1 text-[12px] font-medium" style={{ color: i === 0 || i === 6 ? "#B91C1C" : SLATE }}>{w}</span>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={`b${i}`} />;
              const k = keyOf(view.y, view.m, d);
              const selected = k === value;
              const off = disabled(k);
              return (
                <button
                  key={k}
                  type="button"
                  disabled={off}
                  onClick={() => {
                    onChange(k);
                    setOpen(false);
                  }}
                  aria-pressed={selected}
                  aria-label={thaiDateShort(k)}
                  data-date={k}
                  className="h-9 rounded-lg text-[13px] disabled:cursor-not-allowed"
                  style={{
                    background: selected ? BLUE : "transparent",
                    color: selected ? "#fff" : off ? "#CBD5E1" : NAVY,
                    fontWeight: selected || k === today ? 700 : 400,
                    outline: k === today && !selected ? `1px solid ${BLUE}` : "none",
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={disabled(today)}
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1 text-[13px] font-semibold disabled:opacity-40"
              style={{ color: BLUE }}
            >
              วันนี้
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
