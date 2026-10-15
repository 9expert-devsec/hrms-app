"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Clock,
  Plus,
  Loader2,
  Trash2,
  CalendarDays,
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
} from "lucide-react";

/* ── design tokens ─────────────────────────────────── */
const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const LIME = "#D4F73F";
const SLATE = "#5E6A7E";
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

const STATUS_BADGE = {
  pending:  { bg: "#FEF3C7", color: "#92400E", label: "รออนุมัติ" },
  approved: { bg: "#D1FAE5", color: "#065F46", label: "อนุมัติแล้ว" },
  rejected: { bg: "#FEE2E2", color: "#991B1B", label: "ไม่อนุมัติ" },
};

const HOUR_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export default function OTPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [filter, setFilter] = useState("all");

  /* ── form state ──────────────────────── */
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState(null);
  const [customHours, setCustomHours] = useState("");
  const [reason, setReason] = useState("");

  /* ── auth guard ──────────────────────── */
  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) router.replace("/login");
  }, [session, authStatus, router]);

  /* ── fetch OT requests ───────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/ot", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`);
      setItems(j.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") load();
  }, [authStatus, load]);

  /* ── summary stats ───────────────────── */
  const stats = useMemo(() => {
    let pendingCount = 0, approvedHours = 0, rejectedCount = 0;
    const thisMonth = new Date().toISOString().slice(0, 7);

    for (const it of items) {
      if (it.status === "pending") pendingCount++;
      if (it.status === "rejected") rejectedCount++;
      if (it.status === "approved") {
        const itMonth = it.date ? new Date(it.date).toISOString().slice(0, 7) : "";
        if (itMonth === thisMonth) approvedHours += it.hours || 0;
      }
    }
    return {
      pendingCount,
      approvedHours: Math.round(approvedHours * 100) / 100,
      rejectedCount,
    };
  }, [items]);

  /* ── filtered list ───────────────────── */
  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  /* ── submit OT ───────────────────────── */
  async function handleSubmit(e) {
    e.preventDefault();

    const finalHours = hours ?? (customHours ? Number(customHours) : null);
    if (!finalHours || finalHours < 0.5 || finalHours > 12) {
      alert("กรุณาเลือกจำนวนชั่วโมง OT (0.5 - 12)");
      return;
    }
    if (finalHours % 0.5 !== 0) {
      alert("จำนวนชั่วโมงต้องเป็นทวีคูณของ 0.5");
      return;
    }
    if (!reason.trim() || reason.trim().length < 10) {
      alert("กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร");
      return;
    }
    if (new Date(date) > new Date()) {
      alert("ไม่สามารถแจ้ง OT ล่วงหน้าได้");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance/ot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, hours: finalHours, reason: reason.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "ส่งคำขอไม่สำเร็จ");

      setHours(null);
      setCustomHours("");
      setReason("");
      setDate(new Date().toISOString().slice(0, 10));
      load();
    } catch (err) {
      alert(err.message || "ส่งคำขอไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── cancel OT ───────────────────────── */
  async function handleCancel(id) {
    if (!confirm("ต้องการยกเลิกคำขอ OT นี้ใช่หรือไม่?")) return;
    setCancelling(id);
    try {
      const res = await fetch(`/api/attendance/ot/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "ยกเลิกไม่สำเร็จ");
      load();
    } catch (err) {
      alert(err.message || "ยกเลิกไม่สำเร็จ");
    } finally {
      setCancelling(null);
    }
  }

  /* ── guard render ────────────────────── */
  if (authStatus === "loading" || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin" style={{ color: BLUE }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Header ─────────────────────────── */}
      <header className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-xl grid place-items-center"
          style={{ background: "rgba(0,92,255,0.08)" }}
        >
          <Clock size={20} style={{ color: BLUE }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: NAVY }}>
            แจ้งทำงานล่วงเวลา (OT)
          </h1>
          <p className="text-sm" style={{ color: SLATE }}>
            ยื่นคำขอและติดตามสถานะ OT
          </p>
        </div>
      </header>

      {/* ── Summary Cards ──────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "OT รออนุมัติ", value: `${stats.pendingCount} ครั้ง`, color: "#F59E0B", bg: "#FEF3C7", Icon: AlertTriangle },
          { label: "OT อนุมัติเดือนนี้", value: `${stats.approvedHours} ชม.`, color: "#10B981", bg: "#D1FAE5", Icon: CheckCircle2 },
          { label: "OT ปฏิเสธ", value: `${stats.rejectedCount} ครั้ง`, color: "#EF4444", bg: "#FEE2E2", Icon: XCircle },
        ].map((s) => (
          <div key={s.label} style={CARD} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="h-7 w-7 rounded-lg grid place-items-center"
                style={{ background: s.bg }}
              >
                <s.Icon size={14} style={{ color: s.color }} />
              </div>
              <span className="text-xs font-medium" style={{ color: SLATE }}>
                {s.label}
              </span>
            </div>
            <p className="text-lg font-bold" style={{ color: NAVY }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── OT Request Form ────────────────── */}
      <div style={CARD} className="p-5">
        <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: NAVY }}>
          <Plus size={18} style={{ color: BLUE }} />
          ยื่นคำขอ OT ใหม่
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
              <CalendarDays size={13} className="inline mr-1" style={{ color: BLUE }} />
              วันที่ทำ OT
            </label>
            <input
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              required
              style={INPUT_STYLE}
            />
          </div>

          {/* Hours selector */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
              <Clock size={13} className="inline mr-1" style={{ color: BLUE }} />
              จำนวนชั่วโมง
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {HOUR_OPTIONS.map((h) => {
                const isActive = hours === h && !customHours;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => { setHours(h); setCustomHours(""); }}
                    className="px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
                    style={{
                      background: isActive ? BLUE : ICE,
                      color: isActive ? "#FFFFFF" : NAVY,
                      border: isActive ? `1px solid ${BLUE}` : "1px solid rgba(0,92,255,0.12)",
                      minWidth: 44,
                    }}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: SLATE }}>
                หรือระบุเอง:
              </span>
              <input
                type="number"
                value={customHours}
                min={0.5}
                max={12}
                step={0.5}
                onChange={(e) => { setCustomHours(e.target.value); setHours(null); }}
                placeholder="ชม."
                style={{ ...INPUT_STYLE, width: 90 }}
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
              <FileText size={13} className="inline mr-1" style={{ color: BLUE }} />
              เหตุผล
              <span className="text-xs font-normal ml-1" style={{ color: SLATE }}>
                (อย่างน้อย 10 ตัวอักษร)
              </span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              minLength={10}
              placeholder="ระบุเหตุผลการทำ OT..."
              style={{ ...INPUT_STYLE, resize: "vertical" }}
            />
            <p className="text-xs mt-1 text-right" style={{ color: reason.trim().length >= 10 ? "#10B981" : SLATE }}>
              {reason.trim().length} / 10
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl font-bold text-sm py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
            style={{ background: LIME, color: NAVY }}
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            ยื่นคำขอ OT
          </button>
        </form>
      </div>

      {/* ── OT History ─────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold" style={{ color: NAVY }}>
            ประวัติ OT
          </h2>

          {/* Filter tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: ICE }}>
            {[
              { key: "all", label: "ทั้งหมด" },
              { key: "pending", label: "รอ" },
              { key: "approved", label: "อนุมัติ" },
              { key: "rejected", label: "ปฏิเสธ" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                style={{
                  background: filter === tab.key ? "#FFFFFF" : "transparent",
                  color: filter === tab.key ? NAVY : SLATE,
                  boxShadow: filter === tab.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-24">
            <Loader2 size={22} className="animate-spin" style={{ color: BLUE }} />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12" style={CARD}>
            <Clock size={32} style={{ color: SLATE, margin: "0 auto" }} />
            <p className="mt-2 text-sm" style={{ color: SLATE }}>
              ไม่มีรายการ OT
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((item) => {
              const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;
              return (
                <div key={item._id} style={CARD} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: NAVY }}>
                          {fmtDate(item.date)}
                        </span>
                        <span
                          className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{ background: badge.bg, color: badge.color }}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-sm font-bold mb-0.5" style={{ color: BLUE }}>
                        {item.hours} ชั่วโมง
                      </p>
                      <p
                        className="text-sm leading-relaxed"
                        style={{
                          color: SLATE,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {item.reason}
                      </p>
                      {item.approverNote && (
                        <p className="text-xs mt-1" style={{ color: SLATE }}>
                          หมายเหตุผู้อนุมัติ: {item.approverNote}
                        </p>
                      )}
                    </div>

                    {item.status === "pending" && (
                      <button
                        onClick={() => handleCancel(item._id)}
                        disabled={cancelling === item._id}
                        className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150"
                        style={{ color: "#DC2626", background: "rgba(239,68,68,0.08)" }}
                      >
                        {cancelling === item._id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                        ยกเลิก
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
