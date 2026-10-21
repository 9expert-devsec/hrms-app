"use client";

import { Check } from "lucide-react";
import { PROGRESS_STEPS } from "@/lib/offsiteRules";
import { BLUE, NAVY, SLATE, LIME } from "./ui";

/**
 * สมาชิกตอบรับ → หัวหน้าทีมเซ็น → บัญชี → HR → อนุมัติแล้ว. `progress` comes
 * from lib/offsiteRules.progressOf; `notes[i]` is a small line under step i.
 * Below 480 px five labels do not fit: the current step's name, "ขั้นที่ n/5"
 * and small dots instead.
 */
export default function OffsiteProgress({ progress, notes = [] }) {
  const { position = 0, cancelled = false, done = false } = progress || {};
  const total = PROGRESS_STEPS.length;
  const shown = done ? total - 1 : position;
  return (
    <>
      <div className="min-[480px]:hidden" data-testid="progress-compact" aria-label="ความคืบหน้า">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-bold" style={{ color: NAVY }}>
            {PROGRESS_STEPS[shown]}
            {cancelled && <span style={{ color: SLATE, fontWeight: 500 }}> (ยกเลิก)</span>}
          </span>
          <span className="text-xs" style={{ color: SLATE, whiteSpace: "nowrap" }}>
            ขั้นที่ {shown + 1}/{total}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5" aria-hidden>
          {PROGRESS_STEPS.map((label, i) => {
            const complete = done || i < position;
            const current = !done && !cancelled && i === position;
            return (
              <span
                key={label}
                className="h-2 flex-1 rounded-full"
                style={{ background: complete ? BLUE : current ? LIME : "#E2E8F0", boxShadow: current ? `inset 0 0 0 1px ${NAVY}` : "none" }}
              />
            );
          })}
        </div>
        {notes[shown] && (
          <div className="mt-1 text-[11px]" style={{ color: SLATE }}>
            {notes[shown]}
          </div>
        )}
      </div>
      <ol className="flex w-full items-start max-[479px]:hidden" aria-label="ความคืบหน้า">
        {PROGRESS_STEPS.map((label, i) => {
          const complete = done || i < position;
          const current = !done && !cancelled && i === position;
          const color = cancelled && i >= position ? "#CBD5E1" : complete ? BLUE : current ? NAVY : "#CBD5E1";
          return (
            <li key={label} className="relative flex flex-1 flex-col items-center text-center" aria-current={current ? "step" : undefined}>
              {i > 0 && (
                <span
                  className="absolute top-4 h-0.5"
                  style={{ left: "-50%", width: "100%", background: complete || current ? BLUE : "#E2E8F0", zIndex: 0 }}
                />
              )}
              <span
                className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  background: complete ? BLUE : current ? LIME : "#FFFFFF",
                  color: complete ? "#FFFFFF" : NAVY,
                  border: `2px solid ${color}`,
                  boxShadow: current ? "0 0 0 4px rgba(212,247,63,0.35)" : "none",
                }}
              >
                {complete ? <Check size={14} /> : i + 1}
              </span>
              <span className="mt-2 text-xs" style={{ color: current ? NAVY : SLATE, fontWeight: current ? 700 : 500 }}>
                {label}
              </span>
              {notes[i] && (
                <span className="mt-0.5 px-1 text-[11px]" style={{ color: SLATE }}>
                  {notes[i]}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
