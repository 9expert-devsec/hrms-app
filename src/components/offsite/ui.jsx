"use client";

import { STATUS_LABELS, MEMBER_STATUS_LABELS } from "@/lib/offsiteRules";

/* ── 9Expert design tokens (same as the OT / leave pages) ───────── */
export const NAVY = "#0D1B2A";
export const BLUE = "#005CFF";
export const LIME = "#D4F73F";
export const SLATE = "#5E6A7E";
export const ICE = "#F8FAFD";
export const CARD = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,92,255,0.10)",
  borderRadius: "16px",
  boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
};
export const INPUT_STYLE = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,92,255,0.15)",
  fontSize: 14,
  color: NAVY,
  background: "#FFFFFF",
  outline: "none",
};
export const INPUT_ERROR = { ...INPUT_STYLE, border: "1px solid #EF4444" };

const TONES = {
  grey: { bg: "#F1F5F9", fg: "#475569" },
  blue: { bg: "rgba(0,92,255,0.08)", fg: BLUE },
  amber: { bg: "#FEF3C7", fg: "#92400E" },
  green: { bg: "#DCFCE7", fg: "#166534" },
  red: { bg: "#FEE2E2", fg: "#991B1B" },
};

const STATUS_TONE = {
  draft: "grey",
  inviting: "amber",
  members_ready: "blue",
  in_approval: "blue",
  returned: "red",
  approved: "green",
  cancelled: "grey",
};
const MEMBER_TONE = { invited: "amber", accepted: "green", declined: "red" };

export function Chip({ tone = "grey", children }) {
  const t = TONES[tone] || TONES.grey;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: t.bg, color: t.fg, whiteSpace: "nowrap" }}
    >
      {children}
    </span>
  );
}

export function StatusChip({ status }) {
  return <Chip tone={STATUS_TONE[status]}>{STATUS_LABELS[status] || status}</Chip>;
}

export function MemberStatusChip({ status }) {
  return <Chip tone={MEMBER_TONE[status]}>{MEMBER_STATUS_LABELS[status] || status}</Chip>;
}

export function Button({ variant = "primary", disabled, children, style, ...rest }) {
  const look = {
    primary: { background: disabled ? "#A0AEC0" : `linear-gradient(135deg, ${BLUE}, #2486FF)`, color: "#FFFFFF", border: "none" },
    secondary: { background: "#FFFFFF", color: NAVY, border: "1px solid rgba(0,92,255,0.20)" },
    danger: { background: disabled ? "#FCA5A5" : "#DC2626", color: "#FFFFFF", border: "none" },
    ghost: { background: "transparent", color: "#DC2626", border: "1px solid #FECACA" },
  }[variant];
  return (
    <button
      type="button"
      disabled={disabled}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
      style={{ ...look, cursor: disabled ? "not-allowed" : "pointer", ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Red box for a server error message. */
export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "#FEE2E2", border: "1px solid #FECACA", color: "#991B1B" }}>
      {children}
    </div>
  );
}

/** fetch → JSON; throws an Error carrying the API's `error` message and body. */
export async function api(url, { method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}
