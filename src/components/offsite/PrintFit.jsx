"use client";

import { useEffect, useState } from "react";

const MIN_PT = 11;
const STEP_PT = 0.25;
const PX_PER_PT = 96 / 72;
// Page 1 must hold the whole form: the HR box has to end above the footer.
const BODY_LIMIT_PT = 818;
const LH_PT = 18.92; // Word's single spacing for Angsana New 14 pt (the original)
const MIN_LH_PT = 16;
const DOT_BELOW_BASELINE_GAP = 6.72; // dot centre = line-box top + (pitch − 6.72 pt)

/**
 * When wrapped values push page 1 past the footer, tighten page 1's line
 * pitch just enough (never below 16 pt). Returns the pitch used, or null.
 */
function compactPage1() {
  const sheet = document.querySelector(".pf-sheet");
  const body = sheet?.querySelector(".pf-body");
  if (!body) return null;
  body.style.removeProperty("--lh");
  body.style.removeProperty("--dot-y");
  delete body.dataset.compactLh;
  const bottomPt = () => (body.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top) / PX_PER_PT;
  let lh = LH_PT;
  while (bottomPt() > BODY_LIMIT_PT && lh > MIN_LH_PT) {
    lh = Math.max(MIN_LH_PT, +(lh - 0.1).toFixed(2));
    body.style.setProperty("--lh", `${lh}pt`);
    body.style.setProperty("--dot-y", `${(lh - DOT_BELOW_BASELINE_GAP).toFixed(2)}pt`);
  }
  if (lh < LH_PT) body.dataset.compactLh = String(lh);
  return lh < LH_PT ? lh : null;
}

/** Does Angsana New actually render here? (fonts.check alone is true for any system family name.) */
function hasAngsana() {
  if (typeof document === "undefined") return true;
  let checked = true;
  try {
    checked = document.fonts.check('14pt "Angsana New"');
  } catch {
    checked = true;
  }
  const c = document.createElement("canvas").getContext("2d");
  if (!c) return checked;
  const sample = "ข้าพเจ้า แบบฟอร์ม 0123456789";
  c.font = '40px monospace';
  const mono = c.measureText(sample).width;
  c.font = '40px "Angsana New", monospace';
  return checked && c.measureText(sample).width !== mono;
}

/**
 * The print form must never drop text (ruling OS-6). After the fonts are
 * ready, every value that does not fit its dots is shrunk in 0.25-pt steps
 * down to 11 pt; only below that may it wrap (a single-line field gets a
 * second line, a block field more lines). Shrunk / wrapped elements carry
 * data-fit-pt / data-fit-wrapped so tests can report them. If wrapping would
 * push page 1 past its footer, page 1's line pitch is tightened just enough
 * (data-compact-lh on .pf-body). Also shows the on-screen-only note when
 * Angsana New is not installed.
 */
export default function PrintFit() {
  const [missingFont, setMissingFont] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      for (const el of document.querySelectorAll("[data-fit]")) {
        const block = el.dataset.fit === "block";
        const target = block ? el.querySelector(".pf-ruled-text") || el : el;
        const base = parseFloat(el.dataset.basePt || "14");
        target.style.fontSize = "";
        el.classList.remove("pf-wrapped");
        delete el.dataset.fitPt;
        delete el.dataset.fitWrapped;
        const overflowing = () => (block ? target.scrollHeight > el.clientHeight + 0.5 : el.scrollWidth > el.clientWidth + 0.5);
        let size = base;
        while (overflowing() && size > MIN_PT) {
          size = Math.max(MIN_PT, size - STEP_PT);
          target.style.fontSize = `${size}pt`;
        }
        if (size < base) el.dataset.fitPt = String(size);
        if (overflowing()) {
          el.classList.add("pf-wrapped");
          el.dataset.fitWrapped = "1";
          el.closest(".pf-row")?.classList.add("pf-wrapped");
        }
      }
      compactPage1();
    };
    setMissingFont(!hasAngsana());
    (document.fonts?.ready || Promise.resolve()).then(fit);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!missingFont) return null;
  return (
    <p className="no-print pf-font-note" role="status">
      เครื่องนี้ไม่มีฟอนต์ Angsana New เอกสารจะแสดงด้วยฟอนต์สำรอง
    </p>
  );
}
