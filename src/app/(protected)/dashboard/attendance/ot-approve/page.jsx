"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canAccess } from "@/lib/rbac/access";
import Avatar from "../../../../../components/Avatar";
import { employeeDisplayName } from "@/lib/employeeName";
import { refreshInbox } from "../../../../../components/inbox/InboxProvider";
import {
  CheckSquare,
  Loader2,
  X,
  Clock,
  CalendarDays,
  FileText,
  UserCircle,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
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

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OTApprovePage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");

  /* ── modal state ─────────────────────── */
  const [modal, setModal] = useState(null); // { item, action: 'approve'|'reject' }
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* ── auth guard ──────────────────────── */
  // Registry check (src/lib/rbac); the middleware already enforces it.
  const allowed = canAccess(session?.user, "ot_approve");

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) { router.replace("/login"); return; }
    if (!allowed) {
      router.replace("/403");
    }
  }, [session, authStatus, router, allowed]);

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
    if (authStatus === "authenticated" && allowed) {
      load();
    }
  }, [authStatus, allowed, load]);

  /* ── filtered by tab ─────────────────── */
  const filtered = useMemo(() => {
    return items.filter((i) => i.status === tab);
  }, [items, tab]);

  /* ── tab counts ──────────────────────── */
  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    for (const i of items) {
      if (c[i.status] !== undefined) c[i.status]++;
    }
    return c;
  }, [items]);

  /* ── approve / reject ────────────────── */
  function openModal(item, action) {
    setModal({ item, action });
    setNote("");
  }

  async function handleAction() {
    if (!modal) return;
    if (modal.action === "reject" && !note.trim()) {
      alert("กรุณาระบุเหตุผลที่ปฏิเสธ");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/attendance/ot/${modal.item._id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: modal.action,
          note: note.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "ดำเนินการไม่สำเร็จ");

      setModal(null);
      refreshInbox(); // bell, sidebar badge, dashboard card
      load();
    } catch (err) {
      alert(err.message || "ดำเนินการไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── helpers ─────────────────────────── */
  function getEmpInfo(item) {
    const emp = item.employeeId;
    if (!emp || typeof emp !== "object") return { name: "-", dept: "-", pos: "-", photo: null };
    return {
      name: employeeDisplayName(emp) || "-",
      dept: emp.department || "-",
      pos: emp.position || "-",
      photo: emp.photoUrl || null,
      empAutoId: emp.empAutoId || "",
    };
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
    <div className="space-y-6">
      {/* ── Header ─────────────────────────── */}
      <header className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-xl grid place-items-center"
          style={{ background: "rgba(0,92,255,0.08)" }}
        >
          <CheckSquare size={20} style={{ color: BLUE }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: NAVY }}>
            อนุมัติ OT
          </h1>
          <p className="text-sm" style={{ color: SLATE }}>
            ตรวจสอบและอนุมัติคำขอทำงานล่วงเวลา
          </p>
        </div>
      </header>

      {/* ── Tabs ───────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: ICE, display: "inline-flex" }}>
        {[
          { key: "pending", label: "รออนุมัติ", Icon: AlertTriangle },
          { key: "approved", label: "อนุมัติแล้ว", Icon: CheckCircle2 },
          { key: "rejected", label: "ปฏิเสธแล้ว", Icon: XCircle },
        ].map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
              style={{
                background: isActive ? "#FFFFFF" : "transparent",
                color: isActive ? NAVY : SLATE,
                boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <t.Icon size={14} />
              {t.label}
              {counts[t.key] > 0 && (
                <span
                  className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full text-xs font-bold"
                  style={{
                    background: isActive ? STATUS_BADGE[t.key].bg : "rgba(0,0,0,0.06)",
                    color: isActive ? STATUS_BADGE[t.key].color : SLATE,
                  }}
                >
                  {counts[t.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Loading ────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin" style={{ color: BLUE }} />
        </div>
      )}

      {/* ── Empty state ────────────────────── */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16" style={CARD}>
          <CheckSquare size={40} style={{ color: SLATE, margin: "0 auto" }} />
          <p className="mt-3 text-sm" style={{ color: SLATE }}>
            {tab === "pending" ? "ไม่มีคำขอ OT ที่รออนุมัติ" : `ไม่มีรายการ${STATUS_BADGE[tab]?.label || ""}`}
          </p>
        </div>
      )}

      {/* ── Request Cards ──────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((item) => {
            const emp = getEmpInfo(item);
            const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;

            return (
              <div key={item._id} style={CARD} className="p-5">
                {/* Top: Employee info + status */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    {emp.photo ? (
                      <Avatar src={emp.photo} size={40} style={{ border: "2px solid rgba(0,92,255,0.10)" }} />
                    ) : (
                      <div
                        className="h-10 w-10 rounded-full grid place-items-center"
                        style={{ background: "rgba(0,92,255,0.08)" }}
                      >
                        <UserCircle size={22} style={{ color: BLUE }} />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-sm" style={{ color: NAVY }}>
                        {emp.name}
                      </p>
                      <p className="text-xs" style={{ color: SLATE }}>
                        {emp.dept} · {emp.pos}
                        {emp.empAutoId ? ` · ${emp.empAutoId}` : ""}
                      </p>
                    </div>
                  </div>
                  <span
                    className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Details */}
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl mb-4"
                  style={{ background: ICE }}
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays size={14} style={{ color: SLATE }} />
                    <div>
                      <p className="text-xs" style={{ color: SLATE }}>วันที่</p>
                      <p className="text-sm font-semibold" style={{ color: NAVY }}>
                        {fmtDate(item.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} style={{ color: SLATE }} />
                    <div>
                      <p className="text-xs" style={{ color: SLATE }}>ชั่วโมง OT</p>
                      <p className="text-sm font-bold" style={{ color: BLUE }}>
                        {item.hours} ชม.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                    <FileText size={14} style={{ color: SLATE }} />
                    <div>
                      <p className="text-xs" style={{ color: SLATE }}>ยื่นเมื่อ</p>
                      <p className="text-sm" style={{ color: NAVY }}>
                        {fmtDateTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="mb-4">
                  <p className="text-xs font-semibold mb-1" style={{ color: SLATE }}>
                    เหตุผล
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: NAVY }}>
                    {item.reason}
                  </p>
                </div>

                {/* Approver note (for processed items) */}
                {item.approverNote && (
                  <div
                    className="mb-4 p-3 rounded-xl text-sm"
                    style={{ background: ICE, color: NAVY }}
                  >
                    <span className="text-xs font-semibold" style={{ color: SLATE }}>
                      หมายเหตุผู้อนุมัติ:
                    </span>{" "}
                    {item.approverNote}
                  </div>
                )}

                {/* Approved/rejected timestamp */}
                {item.approvedAt && item.status !== "pending" && (
                  <p className="text-xs mb-4" style={{ color: SLATE }}>
                    {item.status === "approved" ? "อนุมัติเมื่อ" : "ปฏิเสธเมื่อ"}: {fmtDateTime(item.approvedAt)}
                  </p>
                )}

                {/* Action buttons (pending only) */}
                {item.status === "pending" && (
                  <div className="flex items-center gap-2 pt-3" style={{ borderTop: "1px solid rgba(0,92,255,0.08)" }}>
                    <button
                      onClick={() => openModal(item, "approve")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95"
                      style={{ background: "#10B981", color: "#FFFFFF" }}
                    >
                      <CheckCircle2 size={15} />
                      อนุมัติ
                    </button>
                    <button
                      onClick={() => openModal(item, "reject")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5"
                      style={{ color: "#DC2626", background: "rgba(239,68,68,0.08)" }}
                    >
                      <XCircle size={15} />
                      ปฏิเสธ
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Approve / Reject Modal ─────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13,27,42,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div
            className="w-full max-w-md overflow-y-auto"
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              boxShadow: "0 16px 48px rgba(13,27,42,0.2)",
              maxHeight: "90vh",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid rgba(0,92,255,0.08)" }}
            >
              <h3 className="text-lg font-bold" style={{ color: NAVY }}>
                {modal.action === "approve" ? "อนุมัติ OT" : "ปฏิเสธ OT"}
              </h3>
              <button
                onClick={() => setModal(null)}
                className="p-1 rounded-lg"
                style={{ color: SLATE }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Request summary */}
              <div className="p-4 rounded-xl" style={{ background: ICE }}>
                <div className="flex items-center gap-3 mb-3">
                  {(() => {
                    const emp = getEmpInfo(modal.item);
                    return (
                      <>
                        {emp.photo ? (
                          <Avatar src={emp.photo} size={36} />
                        ) : (
                          <div
                            className="h-9 w-9 rounded-full grid place-items-center"
                            style={{ background: "rgba(0,92,255,0.08)" }}
                          >
                            <UserCircle size={18} style={{ color: BLUE }} />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold" style={{ color: NAVY }}>{emp.name}</p>
                          <p className="text-xs" style={{ color: SLATE }}>{emp.dept}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs" style={{ color: SLATE }}>วันที่</span>
                    <p className="font-semibold" style={{ color: NAVY }}>{fmtDate(modal.item.date)}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: SLATE }}>OT</span>
                    <p className="font-bold" style={{ color: BLUE }}>{modal.item.hours} ชม.</p>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-xs" style={{ color: SLATE }}>เหตุผล</span>
                  <p style={{ color: NAVY }}>{modal.item.reason}</p>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
                  หมายเหตุ
                  {modal.action === "reject" && (
                    <span className="text-xs font-normal ml-1" style={{ color: "#DC2626" }}>
                      (จำเป็น)
                    </span>
                  )}
                  {modal.action === "approve" && (
                    <span className="text-xs font-normal ml-1" style={{ color: SLATE }}>
                      (optional)
                    </span>
                  )}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  required={modal.action === "reject"}
                  placeholder={
                    modal.action === "reject"
                      ? "ระบุเหตุผลที่ปฏิเสธ..."
                      : "หมายเหตุเพิ่มเติม (ถ้ามี)..."
                  }
                  style={{ ...INPUT_STYLE, resize: "vertical" }}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150"
                  style={{ color: SLATE, background: ICE }}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleAction}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 disabled:opacity-60"
                  style={{
                    background: modal.action === "approve" ? "#10B981" : "#EF4444",
                    color: "#FFFFFF",
                  }}
                >
                  {submitting && <Loader2 size={15} className="animate-spin" />}
                  {modal.action === "approve" ? (
                    <>
                      <CheckCircle2 size={15} />
                      ยืนยันอนุมัติ
                    </>
                  ) : (
                    <>
                      <XCircle size={15} />
                      ยืนยันปฏิเสธ
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
