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

/** Department code chip: 12 px bold white on the department's colour. */
export function CodeChip({ code, color }) {
  if (!code) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-[6px] px-2 py-0.5 text-[12px] font-bold text-white"
      style={{ background: color || DEFAULT_DEPT_COLOR }}
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
