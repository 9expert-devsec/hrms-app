"use client";

import { Check } from "lucide-react";
import { PROGRESS_STEPS } from "@/lib/offsiteRules";
import { BLUE, NAVY, SLATE, LIME } from "./ui";

/**
 * สมาชิกตอบรับ → ผู้สร้างเซ็น → บัญชี → HR → อนุมัติแล้ว. `progress` comes
 * from lib/offsiteRules.progressOf; `notes[i]` is a small line under step i.
 */
export default function OffsiteProgress({ progress, notes = [] }) {
  const { position = 0, cancelled = false, done = false } = progress || {};
  return (
    <ol className="flex w-full items-start" aria-label="ความคืบหน้า">
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
  );
}
