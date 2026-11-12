// Shared look of the HR pages (ข้อมูลพนักงาน, แผนกและตำแหน่ง, กำหนดหัวหน้าแผนก).
// Server- and client-safe.

export const NAVY = "#0D1B2A";
export const BLUE = "#005CFF";
export const SLATE = "#5E6A7E";
export const MUTED = "#8592A6";
export const LINE = "#E3EAF5";
export const FIELD_LINE = "#D6E0F0";
/** Department chip colour when a department has none. */
export const DEFAULT_DEPT_COLOR = "#475569";

export const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005CFF]";
export const BTN_PRIMARY = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#005CFF] px-4 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-[#0050E0] disabled:opacity-50 ${FOCUS}`;
export const BTN_SECONDARY = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#D6E0F0] bg-white px-4 text-[14px] font-medium text-[#0D1B2A] no-underline transition-colors hover:bg-[#F5F8FF] disabled:opacity-50 ${FOCUS}`;
export const BTN_DANGER = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 text-[14px] font-semibold text-[#B91C1C] transition-colors hover:bg-[#FEE2E2] disabled:opacity-50 ${FOCUS}`;
export const INPUT = "h-11 w-full rounded-xl border border-[#D6E0F0] bg-white px-3 text-[14px] text-[#0D1B2A] outline-none placeholder:text-[#8592A6] focus:ring-2 focus:ring-[#005CFF]/30";
export const PAGE = "-m-6 min-h-full px-4 py-4 md:px-8 md:py-7";
export const PAGE_BG = { background: "#F5F7FB" };

/* WCAG contrast of two "#rrggbb" colours. */
function luminance(hex) {
  let h = String(hex || "").trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const lin = (v) => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(h.slice(0, 2)) + 0.7152 * lin(h.slice(2, 4)) + 0.0722 * lin(h.slice(4, 6));
}
export function contrastRatio(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  if (x === null || y === null) return null;
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Chip text on a department colour: white when it reaches 4.5:1, else navy. */
export function chipTextColor(background) {
  const ratio = contrastRatio("#FFFFFF", background);
  return ratio !== null && ratio >= 4.5 ? "#FFFFFF" : NAVY;
}

/** Department code chip: 12 px bold on the department's colour, text white or navy by contrast. */
export function CodeChip({ code, color }) {
  if (!code) return null;
  const bg = luminance(color) === null ? DEFAULT_DEPT_COLOR : color;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-[6px] px-2 py-0.5 text-[12px] font-bold"
      style={{ background: bg, color: chipTextColor(bg) }}
      data-testid="code-chip"
    >
      {code}
    </span>
  );
}

/** "28 คน · 10 แผนก" style summary: big number + text. */
export function Summary({ value, children, testid }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2" data-testid={testid}>
      <span className="text-[28px] font-bold leading-none" style={{ color: NAVY }}>{value}</span>
      <span className="text-[15px]" style={{ color: SLATE }}>{children}</span>
    </p>
  );
}

export function NoAccountPill() {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: "#FEF3C7", color: "#92400E" }} data-testid="no-account">
      ไม่มีบัญชี
    </span>
  );
}
