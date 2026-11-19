"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  CalendarDays,
  History,
  Filter,
  X,
  FileText,
  MessageSquare,
  Loader2,
  Inbox,
  Eye,
  Pencil,
  Undo2,
} from "lucide-react";
import { STATUS_CHIPS, WITHDRAWABLE_STATUSES } from "@/lib/leave/flow";
import { formatLeaveAmount, thaiDateRange } from "@/lib/leave/format";
import CancelRequestDialog from "../../../../../components/leave/CancelRequestDialog";

/* ── design tokens ─────────────────────────────────── */
const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const SLATE = "#5E6A7E";
const ICE = "#F8FAFD";
const CARD = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,92,255,0.10)",
  borderRadius: "16px",
  boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
};

// Round-40 statuses plus the legacy ones (lib/leave/flow.js).
const STATUS_BADGE = STATUS_CHIPS;

// Amount of a leave: hours (round 40) or the legacy day count.
function amountText(item) {
  if (typeof item.totalHours !== "number") return `${item.totalDays} day${item.totalDays > 1 ? "s" : ""}`;
  const hoursPerDay = item.totalDays ? item.totalHours / item.totalDays : undefined;
  return formatLeaveAmount(item.totalHours, { unit: item.unit, hoursPerDay });
}

const TYPE_LABELS = {
  sick: "Sick Leave",
  annual: "Annual Leave",
  personal: "Personal Leave",
  maternity: "Maternity Leave",
  paternity: "Paternity Leave",
  other: "Other",
};

const REJECTED_BY_LABEL = { hod: "หัวหน้าแผนก", hr: "HR" };

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LeaveHistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cancelling, setCancelling] = useState(null);
  const [cancelFor, setCancelFor] = useState(null); // approved leave → ขอยกเลิกใบลา dialog

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (year) params.set("year", year);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/leave?${params}`);
      const j = await res.json();
      setItems(j.ok ? j.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [year, statusFilter]); // eslint-disable-line

  const filtered = useMemo(() => {
    if (!typeFilter) return items;
    return items.filter((i) => i.leaveType === typeFilter);
  }, [items, typeFilter]);

  // Legacy "pending" records: DELETE; round-40 statuses: withdraw (→ cancelled).
  async function handleCancel(id, withdraw = false) {
    if (!confirm(withdraw ? "ยกเลิกใบลานี้? ใบลาจะเปลี่ยนเป็น “ยกเลิกแล้ว”" : "Are you sure you want to cancel this leave request?")) return;
    setCancelling(id);
    try {
      const res = withdraw
        ? await fetch(`/api/leave/${id}/withdraw`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
        : await fetch(`/api/leave/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Error");
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }} className="space-y-6">
      {/* ── Header ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "rgba(0,92,255,0.08)", color: BLUE }}
        >
          <History size={22} strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{ color: NAVY, fontSize: 22, fontWeight: 700 }}>Leave History</h1>
          <p style={{ color: SLATE, fontSize: 13 }}>View and manage your leave requests</p>
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────── */}
      <div style={CARD} className="flex flex-wrap items-center gap-3 p-4">
        <Filter size={16} style={{ color: SLATE }} />

        <select
          className="touch-44"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,92,255,0.15)",
            fontSize: 13,
            color: NAVY,
            background: ICE,
          }}
        >
          {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          className="touch-44"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,92,255,0.15)",
            fontSize: 13,
            color: NAVY,
            background: ICE,
          }}
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          className="touch-44"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,92,255,0.15)",
            fontSize: 13,
            color: NAVY,
            background: ICE,
          }}
        >
          <option value="">All Status</option>
          <option value="pending_approval">รอผู้อนุมัติ</option>
          <option value="returned">ส่งกลับแก้ไข</option>
          <option value="pending_hr">รอ HR</option>
          <option value="pending">รอ HOD อนุมัติ</option>
          <option value="hod_approved">รอ HR อนุมัติ</option>
          <option value="approved">อนุมัติแล้ว</option>
          <option value="cancel_requested">ขอยกเลิก</option>
          <option value="rejected">ไม่อนุมัติ</option>
          <option value="cancelled">ยกเลิก</option>
        </select>

        {(typeFilter || statusFilter) && (
          <button
            onClick={() => { setTypeFilter(""); setStatusFilter(""); }}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5"
            style={{ color: BLUE, fontSize: 12, fontWeight: 500 }}
          >
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      {/* ── List ──────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: BLUE }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={CARD} className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox size={48} style={{ color: SLATE, opacity: 0.4 }} />
          <p style={{ color: NAVY, fontSize: 16, fontWeight: 600, marginTop: 12 }}>No leave records found</p>
          <p style={{ color: SLATE, fontSize: 13, marginTop: 4 }}>
            {statusFilter || typeFilter
              ? "Try adjusting your filters"
              : "You haven't submitted any leave requests yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;
            const rejNote = item.status === "rejected"
              ? (item.rejectedBy === "hr" ? item.hrApproverNote : item.hodApproverNote)
              : null;

            return (
              <div key={item._id} style={CARD} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ color: NAVY, fontSize: 15, fontWeight: 600 }}>
                        {item.leaveTypeName || TYPE_LABELS[item.leaveType] || item.leaveType}
                      </span>
                      <span
                        className="inline-flex rounded-full px-2.5 py-0.5"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-4" style={{ color: SLATE, fontSize: 13 }}>
                      <span className="flex items-center gap-1">
                        <CalendarDays size={14} />
                        {fmtDate(item.startDate)} - {fmtDate(item.endDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText size={14} />
                        {amountText(item)}
                      </span>
                    </div>

                    <p style={{ color: SLATE, fontSize: 13, marginTop: 4 }}>{item.reason}</p>

                    {/* Rejection info */}
                    {item.status === "rejected" && (
                      <div
                        className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2"
                        style={{ background: "#FEE2E210", border: "1px solid #FEE2E240" }}
                      >
                        <MessageSquare size={14} style={{ color: "#991B1B", marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <span style={{ fontSize: 12, color: "#991B1B", fontWeight: 600 }}>
                            ไม่อนุมัติโดย {REJECTED_BY_LABEL[item.rejectedBy] || item.rejectedBy || "-"}
                          </span>
                          {rejNote && (
                            <p style={{ fontSize: 13, color: "#991B1B", marginTop: 2 }}>{rejNote}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Cancel request (round 42) */}
                    {item.status === "cancel_requested" && item.cancelRequest?.reason && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                        <MessageSquare size={14} style={{ color: "#B91C1C", marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#B91C1C" }}>ขอยกเลิก — รอฝ่ายบุคคลอนุมัติ: {item.cancelRequest.reason}</span>
                      </div>
                    )}
                    {item.status === "approved" && item.cancelRequest?.decision === "rejected" && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: "#F8FAFD", border: "1px solid #E3EAF5" }}>
                        <MessageSquare size={14} style={{ color: SLATE, marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: SLATE }}>คำขอยกเลิกไม่ได้รับอนุมัติ{item.cancelRequest.note ? `: ${item.cancelRequest.note}` : ""}</span>
                      </div>
                    )}

                    {/* Returned for editing (round 40) */}
                    {item.status === "returned" && item.returnInfo?.reason && (
                      <div
                        className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2"
                        style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
                      >
                        <MessageSquare size={14} style={{ color: "#B91C1C", marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#B91C1C" }}>ส่งกลับแก้ไข: {item.returnInfo.reason}</span>
                      </div>
                    )}

                    {/* HOD note when hod_approved */}
                    {item.status === "hod_approved" && item.hodApproverNote && (
                      <div
                        className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2"
                        style={{ background: "#DBEAFE10", border: "1px solid #DBEAFE40" }}
                      >
                        <MessageSquare size={14} style={{ color: "#1E40AF", marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#1E40AF" }}>HOD: {item.hodApproverNote}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {/* View document: every round-40+ leave; old-flow approved ones */}
                    {(item.leaveTypeId || item.status === "approved" || item.status === "hod_approved") && (
                      <Link
                        href={`/dashboard/leave/document?id=${item._id}`}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors"
                        style={{
                          border: `1px solid ${BLUE}20`,
                          color: BLUE,
                          fontSize: 12,
                          fontWeight: 500,
                          background: `${BLUE}08`,
                        }}
                      >
                        <Eye size={14} />
                        ดูเอกสาร
                      </Link>
                    )}

                    {/* Returned: edit and resubmit on the ขอลา page */}
                    {item.status === "returned" && (
                      <Link
                        href={`/dashboard/leave/request?id=${item._id}`}
                        className="touch-44 flex items-center gap-1 rounded-lg px-3 py-1.5"
                        style={{ border: `1px solid ${BLUE}20`, color: BLUE, fontSize: 12, fontWeight: 500, background: `${BLUE}08` }}
                        data-testid="history-edit"
                      >
                        <Pencil size={14} />
                        แก้ไขและส่งใหม่
                      </Link>
                    )}

                    {/* Cancel after final approval (round 42): HR decides */}
                    {item.leaveTypeId && item.status === "approved" && (
                      <button
                        onClick={() => setCancelFor(item)}
                        className="touch-44 flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors"
                        style={{ border: "1px solid #F87171", color: "#B91C1C", fontSize: 12, fontWeight: 500, background: "#fff" }}
                        data-testid="history-cancel-request"
                      >
                        <Undo2 size={14} />
                        ขอยกเลิกใบลา
                      </button>
                    )}

                    {/* Withdraw before final approval (round 40) */}
                    {WITHDRAWABLE_STATUSES.includes(item.status) && (
                      <button
                        onClick={() => handleCancel(item._id, true)}
                        disabled={cancelling === item._id}
                        className="touch-44 flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors"
                        style={{ border: "1px solid #FEE2E2", color: "#991B1B", fontSize: 12, fontWeight: 500, background: "#FEE2E220" }}
                        data-testid="history-withdraw"
                      >
                        {cancelling === item._id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                        ยกเลิกใบลา
                      </button>
                    )}

                    {/* Cancel button for pending (legacy) */}
                    {item.status === "pending" && (
                      <button
                        onClick={() => handleCancel(item._id)}
                        disabled={cancelling === item._id}
                        className="touch-44 flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors"
                        style={{
                          border: "1px solid #FEE2E2",
                          color: "#991B1B",
                          fontSize: 12,
                          fontWeight: 500,
                          background: "#FEE2E220",
                        }}
                      >
                        {cancelling === item._id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <X size={14} />
                        )}
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cancelFor && (
        <CancelRequestDialog
          leaveId={cancelFor._id}
          summary={`${cancelFor.leaveTypeName || "-"} · ${thaiDateRange(cancelFor.startDate, cancelFor.endDate)} · ${amountText(cancelFor)}`}
          returnText={amountText({ ...cancelFor, unit: undefined })}
          onClose={() => setCancelFor(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
