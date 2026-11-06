"use client";

import { useEffect, useState } from "react";
import { placeSignatures, prepareSignatures } from "./printSignatures";

/** Fired on window (and data-print-ready="true" set on .pf-doc) once the form may be printed. */
export const PRINT_READY_EVENT = "pf-print-ready";

const MIN_PT = 11;
const STEP_PT = 0.25;
const PX_PER_PT = 96 / 72;
// A sheet must hold its whole body: page 1's HR box (bottom ≈ 831.5 pt at the normal pitch) has to stay on it.
const BODY_LIMIT_PT = 832;
const CONT_TEMPLATE = "[data-pf-cont-template]";
const LH_PT = 18.92; // Word's single spacing for Angsana New 14 pt (the original)
const MIN_LH_PT = 16;
const PROBE_DOTS = 40;
const SHEET_PX = 595.28 * PX_PER_PT; // one A4 sheet at 100 %
const FIT_GUTTER_PX = 16;

/**
 * Phones: scale the ON-SCREEN preview so a sheet fits the screen width
 * (--pf-fit → `zoom` under @media screen in PRINT_CSS; print stays at 100 %).
 * Runs only after the form is measured and print-ready; it scales every sheet,
 * however many continuation sheets there are. A mobile browser
 * widens the layout viewport to fit an overflowing page, so the device width
 * (screen.width) bounds it too.
 */
function fitPreview() {
  const avail = Math.min(window.innerWidth, window.screen?.width || window.innerWidth) - FIT_GUTTER_PX;
  const scale = Math.min(1, avail / SHEET_PX);
  document.documentElement.style.setProperty("--pf-fit", String(+scale.toFixed(4)));
}

/**
 * Leaders are typed periods rendered long and clipped; trim each to the whole
 * periods that fit its width so no dot is cut at the end.
 */
function trimLeaders() {
  for (const el of document.querySelectorAll(".pf-dots, .pf-ruled-dots, .pf-sign-dots, .pf-sig-dots")) {
    el.textContent = ".".repeat(PROBE_DOTS);
    const range = document.createRange();
    range.selectNodeContents(el);
    const advance = range.getBoundingClientRect().width / PROBE_DOTS;
    const width = el.getBoundingClientRect().width;
    el.textContent = advance > 0 ? ".".repeat(Math.floor((width + 0.01) / advance)) : "";
  }
}

/** Does this sheet's body end inside the sheet? */
function bodyFits(sheet) {
  const bottom = sheet.querySelector(".pf-body").getBoundingClientRect().bottom;
  return (bottom - sheet.getBoundingClientRect().top) / PX_PER_PT <= BODY_LIMIT_PT;
}

/**
 * When wrapped values push page 1 past the footer, tighten its line pitch
 * just enough (never below 16 pt).
 */
function compactPage1(sheet) {
  const body = sheet.querySelector(".pf-body");
  body.style.removeProperty("--lh");
  delete body.dataset.compactLh;
  let lh = LH_PT;
  while (!bodyFits(sheet) && lh > MIN_LH_PT) {
    lh = Math.max(MIN_LH_PT, +(lh - 0.1).toFixed(2));
    body.style.setProperty("--lh", `${lh}pt`);
  }
  if (lh < LH_PT) body.dataset.compactLh = String(lh);
}

/** A new continuation sheet before the regulations page; returns its table body. */
function addContinuationSheet(template) {
  const sheet = template.cloneNode(true);
  sheet.removeAttribute("hidden");
  sheet.removeAttribute("data-pf-cont-template");
  sheet.dataset.testid = "offsite-print-continuation";
  template.before(sheet);
  return sheet.querySelector("tbody");
}

/**
 * Page 1 first: the rest of the form is settled with one member row (the
 * table's block holds its place), then whole rows stay while the body ends
 * inside the sheet, the pointer line under the table counted once any row
 * leaves. The remaining rows fill continuation sheets by the same test. A
 * sheet always takes at least one row, so this always ends.
 */
function paginateMembers() {
  const sheet = document.querySelector(".pf-sheet");
  const rows = [...sheet.querySelectorAll(".pf-mtable tbody tr")];
  const template = document.querySelector(CONT_TEMPLATE);
  const tbody = rows[0]?.parentElement;
  rows.slice(1).forEach((row) => row.remove());
  compactPage1(sheet);
  if (!tbody) return;
  rows.slice(1).forEach((row) => tbody.append(row));

  let kept = rows.length;
  while (kept > 1 && !bodyFits(sheet)) {
    kept -= 1;
    rows[kept].remove();
    sheet.querySelector(".pf-more").hidden = false;
  }

  let current = null;
  for (const row of rows.slice(kept)) {
    current?.append(row);
    if (!current || !bodyFits(current.closest(".pf-sheet"))) {
      current = addContinuationSheet(template);
      current.append(row);
    }
  }
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
 * ready, every value that does not fit its segment is shrunk in 0.25-pt steps
 * down to 11 pt; only below that may it wrap (a single-line field gets a
 * second line, a block field more lines). Shrunk / wrapped elements carry
 * data-fit-pt / data-fit-wrapped so tests can report them. If wrapping would
 * push page 1 past its footer, its line pitch is tightened just enough
 * (data-compact-lh on .pf-body). The member rows are then paginated by
 * measurement (paginateMembers), the dot leaders trimmed to whole periods and
 * the signatures (prepared for print first) set on their dotted lines.
 * Only then is the form print-ready: data-print-ready="true" on
 * .pf-doc and PRINT_READY_EVENT, which enables the print button. Also shows
 * the on-screen-only note when Angsana New is not installed.
 */
export default function PrintFit() {
  const [missingFont, setMissingFont] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      for (const el of document.querySelectorAll("[data-fit]")) {
        const block = el.dataset.fit === "block";
        const box = block ? el.querySelector(".pf-ruled-text") : el;
        // Only the value shrinks (an inline span), so the line keeps its baseline.
        const text = el.querySelector(block ? ".pf-rv" : ".pf-vt");
        if (!box || !text) continue;
        const base = parseFloat(el.dataset.basePt || "14");
        text.style.fontSize = "";
        el.classList.remove("pf-wrapped");
        delete el.dataset.fitPt;
        delete el.dataset.fitWrapped;
        const overflowing = () => (block ? box.scrollHeight > el.clientHeight + 0.5 : el.scrollWidth > el.clientWidth + 0.5);
        let size = base;
        while (overflowing() && size > MIN_PT) {
          size = Math.max(MIN_PT, size - STEP_PT);
          text.style.fontSize = `${size}pt`;
        }
        if (size < base) el.dataset.fitPt = String(size);
        if (overflowing()) {
          el.classList.add("pf-wrapped");
          el.dataset.fitWrapped = "1";
          el.closest(".pf-row")?.classList.add("pf-wrapped");
        }
      }
      paginateMembers();
      trimLeaders();
    };
    const run = async () => {
      await Promise.all([document.fonts?.ready, prepareSignatures()]);
      if (cancelled) return;
      fit();
      placeSignatures();
      const doc = document.querySelector(".pf-doc");
      if (doc) doc.dataset.printReady = "true";
      window.dispatchEvent(new Event(PRINT_READY_EVENT));
      // Measured at 100 % above; only now scale the screen preview.
      fitPreview();
      window.addEventListener("resize", fitPreview);
    };
    setMissingFont(!hasAngsana());
    run();
    return () => {
      cancelled = true;
      window.removeEventListener("resize", fitPreview);
    };
  }, []);

  if (!missingFont) return null;
  return (
    <p className="no-print pf-font-note" role="status">
      เครื่องนี้ไม่มีฟอนต์ Angsana New เอกสารจะแสดงด้วยฟอนต์สำรอง
    </p>
  );
}
