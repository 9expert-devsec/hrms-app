"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  Thermometer,
  Palmtree,
  UserRound,
  CalendarDays,
  FileText,
  Loader2,
  Inbox,
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

const STATUS_BADGE = {
  pending:   { bg: "#FEF3C7", color: "#92400E" },
  approved:  { bg: "#D1FAE5", color: "#065F46" },
  rejected:  { bg: "#FEE2E2", color: "#991B1B" },
  cancelled: { bg: "#F1F5F9", color: "#475569" },
};

const TYPE_LABELS = {
  sick: "Sick Leave",
  annual: "Annual Leave",
  personal: "Personal Leave",
  maternity: "Maternity Leave",
  paternity: "Paternity Leave",
  other: "Other",
};

const BALANCE_META = [
  { key: "sick", label: "Sick Leave", Icon: Thermometer, color: "#EF4444" },
  { key: "annual", label: "Annual Leave", Icon: Palmtree, color: BLUE },
  { key: "personal", label: "Personal Leave", Icon: UserRound, color: "#8B5CF6" },
];

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LeaveBalancePage() {
  const currentYear = new Date().getFullYear();
  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingBal, setLoadingBal] = useState(true);
  const [loadingHist, setLoadingHist] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/leave/balance?year=${currentYear}`);
        const j = await res.json();
        if (j.ok) setBalance(j.balance);
      } catch {} finally { setLoadingBal(false); }
    })();

    (async () => {
      try {
        const res = await fetch(`/api/leave?year=${currentYear}`);
        const j = await res.json();
        setHistory(j.ok ? j.items : []);
      } catch {
        setHistory([]);
      } finally { setLoadingHist(false); }
    })();
  }, [currentYear]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }} className="space-y-6">
      {/* ── Header ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "rgba(0,92,255,0.08)", color: BLUE }}
        >
          <Wallet size={22} strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{ color: NAVY, fontSize: 22, fontWeight: 700 }}>Leave Balance</h1>
          <p style={{ color: SLATE, fontSize: 13 }}>
            Your leave balance for {currentYear}
          </p>
        </div>
      </div>

      {/* ── Balance Cards ────────────────────── */}
      {loadingBal ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: BLUE }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {BALANCE_META.map((m) => {
            const data = balance?.[m.key];
            const total = data?.total ?? 0;
            const used = data?.used ?? 0;
            const remaining = data?.remaining ?? 0;
            const pct = total > 0 ? Math.round((used / total) * 100) : 0;

            return (
              <div key={m.key} style={CARD} className="p-5">
                {/* Icon + Label */}
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: `${m.color}14`, color: m.color }}
                  >
                    <m.Icon size={18} strokeWidth={2} />
                  </div>
                  <span style={{ color: NAVY, fontSize: 14, fontWeight: 600 }}>{m.label}</span>
                </div>

                {/* Numbers */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                    <div style={{ color: NAVY, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{total}</div>
                    <div style={{ color: SLATE, fontSize: 11, marginTop: 2 }}>Total</div>
                  </div>
                  <div className="text-center">
                    <div style={{ color: m.color, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{used}</div>
                    <div style={{ color: SLATE, fontSize: 11, marginTop: 2 }}>Used</div>
                  </div>
                  <div className="text-center">
                    <div style={{ color: "#065F46", fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{remaining}</div>
                    <div style={{ color: SLATE, fontSize: 11, marginTop: 2 }}>Remaining</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "#F1F5F9" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: BLUE,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span style={{ fontSize: 11, color: SLATE }}>{pct}% used</span>
                  <span style={{ fontSize: 11, color: SLATE }}>{remaining} days left</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── History Table ─────────────────────── */}
      <div style={CARD} className="overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,92,255,0.08)" }}>
          <h2 style={{ color: NAVY, fontSize: 16, fontWeight: 700 }}>
            Leave History — {currentYear}
          </h2>
        </div>

        {loadingHist ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={{ color: BLUE }} />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox size={40} style={{ color: SLATE, opacity: 0.4 }} />
            <p style={{ color: NAVY, fontSize: 14, fontWeight: 600, marginTop: 8 }}>No leave records</p>
            <p style={{ color: SLATE, fontSize: 12, marginTop: 2 }}>
              You haven&apos;t taken any leave this year
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 13 }}>
              <thead>
                <tr style={{ background: ICE }}>
                  <th className="px-5 py-3 text-left" style={{ color: SLATE, fontWeight: 600, fontSize: 12 }}>Type</th>
                  <th className="px-5 py-3 text-left" style={{ color: SLATE, fontWeight: 600, fontSize: 12 }}>Date Range</th>
                  <th className="px-5 py-3 text-center" style={{ color: SLATE, fontWeight: 600, fontSize: 12 }}>Days</th>
                  <th className="px-5 py-3 text-left" style={{ color: SLATE, fontWeight: 600, fontSize: 12 }}>Reason</th>
                  <th className="px-5 py-3 text-center" style={{ color: SLATE, fontWeight: 600, fontSize: 12 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;
                  return (
                    <tr
                      key={item._id}
                      style={{ borderTop: "1px solid rgba(0,92,255,0.06)" }}
                    >
                      <td className="px-5 py-3" style={{ color: NAVY, fontWeight: 500 }}>
                        {TYPE_LABELS[item.leaveType] || item.leaveType}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap" style={{ color: SLATE }}>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={13} />
                          {fmtDate(item.startDate)} - {fmtDate(item.endDate)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center" style={{ color: NAVY, fontWeight: 600 }}>
                        {item.totalDays}
                      </td>
                      <td className="px-5 py-3" style={{ color: SLATE, maxWidth: 200 }}>
                        <span className="line-clamp-1">{item.reason || "-"}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className="inline-flex rounded-full px-2.5 py-0.5"
                          style={{
                            background: badge.bg,
                            color: badge.color,
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: "capitalize",
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
