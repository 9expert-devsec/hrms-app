"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  canAccess,
  canOpenLeaveApproval,
  isAnyHead,
} from "@/lib/rbac/access";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarDays,
  FileText,
  User,
  Building2,
  Loader2,
  Inbox,
  X,
} from "lucide-react";
import SignaturePad from "../../../../../components/SignaturePad";
import Avatar from "../../../../../components/Avatar";
import SignatureDisplay from "../../../../../components/SignatureDisplay";
import AttachmentViewer, { hasAttachments } from "../../../../../components/AttachmentViewer";
import { employeeDisplayName } from "@/lib/employeeName";

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

const STATUS_BADGE = {
  pending:      { bg: "#FEF3C7", color: "#92400E", label: "รอ HOD อนุมัติ" },
  hod_approved: { bg: "#DBEAFE", color: "#1E40AF", label: "รอ HR อนุมัติ" },
  approved:     { bg: "#D1FAE5", color: "#065F46", label: "อนุมัติแล้ว" },
  rejected:     { bg: "#FEE2E2", color: "#991B1B", label: "ไม่อนุมัติ" },
  cancelled:    { bg: "#F1F5F9", color: "#475569", label: "ยกเลิก" },
};

const TYPE_LABELS = {
  sick: "Sick Leave",
  annual: "Annual Leave",
  personal: "Personal Leave",
  maternity: "Maternity Leave",
  paternity: "Paternity Leave",
  other: "Other",
};

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LeaveApprovePage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [tab, setTab] = useState(null); // set after role is known
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── modal state ───────────────────────── */
  const [modal, setModal] = useState(null); // { item, action: 'approve'|'reject' }
  const [note, setNote] = useState("");
  const [signature, setSignature] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  /* ── permission-based config (src/lib/rbac) ── */
  const user = session?.user;
  const allowed = canOpenLeaveApproval(user);
  // HOD step: departments the user heads, or every department with
  // scope_leave_all_depts. HR step: scope_leave_hr_step. Superadmin: both.
  const isHOD = isAnyHead(user) || canAccess(user, "scope_leave_all_depts");
  const isHR  = canAccess(user, "scope_leave_hr_step");

  const TABS = useMemo(() => {
    const tabs = [];
    if (isHOD) tabs.push({ key: "pending_hod", label: "รอดำเนินการ (HOD)", Icon: Clock });
    if (isHR)  tabs.push({ key: "pending_hr",  label: "รอดำเนินการ (HR)",  Icon: Clock });
    tabs.push({ key: "approved", label: "อนุมัติแล้ว", Icon: CheckCircle2 });
    tabs.push({ key: "rejected", label: "ปฏิเสธแล้ว", Icon: XCircle });
    return tabs;
  }, [isHOD, isHR]);

  /* ── set default tab based on role ─────── */
  useEffect(() => {
    if (authStatus !== "loading" && session && tab === null) {
      // HOD-only or superadmin → default to HOD tab
      if (isHOD) setTab("pending_hod");
      // HR-only → default to HR tab
      else if (isHR) setTab("pending_hr");
      else setTab("approved");
    }
  }, [authStatus, session, isHOD, isHR, tab]);

  /* ── role gate ─────────────────────────── */
  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) { router.replace("/login"); return; }
    if (!allowed) {
      router.replace("/403");
    }
  }, [session, authStatus, router, allowed]);

  /* ── fetch data ────────────────────────── */
  async function load() {
    if (!tab) return;
    setLoading(true);
    try {
      let endpoint;
      if (tab === "pending_hod") {
        endpoint = "/api/leave/pending?step=hod";
      } else if (tab === "pending_hr") {
        endpoint = "/api/leave/pending?step=hr";
      } else {
        // approved / rejected tabs — fetch from main leave API
        endpoint = `/api/leave?scope=all&status=${tab}`;
      }
      const res = await fetch(endpoint);
      const j = await res.json();
      setItems(j.ok ? j.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authStatus !== "loading" && session && tab) load();
  }, [tab, session, authStatus]); // eslint-disable-line

  /* ── approve/reject ────────────────────── */
  async function handleConfirm() {
    if (!modal) return;
    if (modal.action === "approve" && !signature) {
      alert("กรุณาลงลายเซ็นก่อนอนุมัติ");
      return;
    }
    if (modal.action === "reject" && !note.trim()) {
      alert("กรุณาระบุเหตุผลที่ไม่อนุมัติ");
      return;
    }
    setSubmitting(true);
    try {
      const body = { action: modal.action, note };
      if (modal.action === "approve" && signature) body.signature = signature;
      const res = await fetch(`/api/leave/${modal.item._id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Error");
      setModal(null);
      setNote("");
      setSignature(null);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function openModal(item, action) {
    setModal({ item, action });
    setNote("");
    setSignature(null);
  }

  if (authStatus === "loading" || tab === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin" style={{ color: BLUE }} />
      </div>
    );
  }

  const isPendingTab = tab === "pending_hod" || tab === "pending_hr";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }} className="space-y-6">
      {/* ── Header ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "rgba(0,92,255,0.08)", color: BLUE }}
        >
          <ShieldCheck size={22} strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{ color: NAVY, fontSize: 22, fontWeight: 700 }}>Leave Approvals</h1>
          <p style={{ color: SLATE, fontSize: 13 }}>Review and manage leave requests</p>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 transition-all duration-200"
              style={{
                background: active ? BLUE : "#FFFFFF",
                color: active ? "#FFFFFF" : NAVY,
                border: active ? "none" : "1px solid rgba(0,92,255,0.10)",
                fontSize: 13,
                fontWeight: 600,
                boxShadow: active ? "0 2px 8px rgba(0,92,255,0.25)" : "0 2px 8px rgba(13,27,42,0.06)",
              }}
            >
              <t.Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── List ──────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: BLUE }} />
        </div>
      ) : items.length === 0 ? (
        <div style={CARD} className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox size={48} style={{ color: SLATE, opacity: 0.4 }} />
          <p style={{ color: NAVY, fontSize: 16, fontWeight: 600, marginTop: 12 }}>
            ไม่มีรายการ
          </p>
          <p style={{ color: SLATE, fontSize: 13, marginTop: 4 }}>
            ไม่มีใบลาที่ต้องดำเนินการในขณะนี้
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const emp = item.employeeId || {};
            const empName = employeeDisplayName(emp) || "-";
            const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;

            return (
              <div key={item._id} style={CARD} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Employee info */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        {emp.photoUrl ? (
                          <Avatar src={emp.photoUrl} alt={empName} size={32} />
                        ) : (
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full"
                            style={{ background: "rgba(0,92,255,0.08)", color: BLUE }}
                          >
                            <User size={15} />
                          </div>
                        )}
                        <div>
                          <span style={{ color: NAVY, fontSize: 14, fontWeight: 600 }}>{empName}</span>
                          <div className="flex items-center gap-2" style={{ color: SLATE, fontSize: 12 }}>
                            {emp.position && <span>{emp.position}</span>}
                            {emp.department && (
                              <>
                                <span style={{ opacity: 0.4 }}>|</span>
                                <span className="flex items-center gap-0.5">
                                  <Building2 size={11} /> {emp.department}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

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

                    {/* Leave details */}
                    <div className="flex flex-wrap items-center gap-4" style={{ color: SLATE, fontSize: 13 }}>
                      <span style={{ color: NAVY, fontWeight: 600 }}>
                        {TYPE_LABELS[item.leaveType] || item.leaveType}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays size={14} />
                        {fmtDate(item.startDate)} - {fmtDate(item.endDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText size={14} />
                        {item.totalDays} day{item.totalDays > 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Reason */}
                    <p style={{ color: SLATE, fontSize: 13 }}>{item.reason}</p>

                    {/* Attachments */}
                    {hasAttachments(item) && <AttachmentViewer leave={item} />}

                    {/* Employee signature preview */}
                    {item.employeeSignature && (
                      <div style={{ marginTop: 8 }}>
                        <SignatureDisplay
                          signature={item.employeeSignature}
                          label="ลายเซ็นผู้ขอลา"
                          signerName={empName}
                        />
                      </div>
                    )}

                    {/* HOD signature & note (shown on HR tab) */}
                    {tab === "pending_hr" && (
                      <div style={{ marginTop: 8 }} className="space-y-2">
                        {item.hodApproverNote && (
                          <div
                            className="flex items-start gap-2 rounded-lg px-3 py-2"
                            style={{ background: "#D1FAE510", border: "1px solid #D1FAE540" }}
                          >
                            <span style={{ fontSize: 12, color: "#065F46" }}>
                              HOD Note: {item.hodApproverNote}
                            </span>
                          </div>
                        )}
                        {item.hodSignature && (
                          <SignatureDisplay
                            signature={item.hodSignature}
                            label="ลายเซ็นหัวหน้าแผนก"
                            signedAt={item.hodApprovedAt}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons — only on pending tabs */}
                  {isPendingTab && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => openModal(item, "approve")}
                        className="flex items-center gap-1.5 rounded-lg px-4 py-2 transition-colors"
                        style={{
                          background: "#065F46",
                          color: "#FFFFFF",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        <CheckCircle2 size={15} />
                        อนุมัติ
                      </button>
                      <button
                        onClick={() => openModal(item, "reject")}
                        className="flex items-center gap-1.5 rounded-lg px-4 py-2 transition-colors"
                        style={{
                          background: "#991B1B",
                          color: "#FFFFFF",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        <XCircle size={15} />
                        ปฏิเสธ
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Confirmation Modal ────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13,27,42,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 overflow-y-auto"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 16px 48px rgba(13,27,42,0.2)",
              maxHeight: "90vh",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: NAVY, fontSize: 18, fontWeight: 700 }}>
                {modal.action === "approve" ? "อนุมัติใบลา" : "ปฏิเสธใบลา"}
              </h3>
              <button
                onClick={() => setModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: ICE, color: SLATE }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Leave summary */}
            {(() => {
              const emp = modal.item.employeeId || {};
              const empName = employeeDisplayName(emp) || "-";
              return (
                <div
                  className="rounded-xl p-4 mb-4 space-y-1"
                  style={{ background: ICE, border: "1px solid rgba(0,92,255,0.08)" }}
                >
                  <div style={{ color: NAVY, fontSize: 14, fontWeight: 600 }}>{empName}</div>
                  <div style={{ color: SLATE, fontSize: 13 }}>
                    {TYPE_LABELS[modal.item.leaveType] || modal.item.leaveType}
                  </div>
                  <div style={{ color: SLATE, fontSize: 13 }}>
                    {fmtDate(modal.item.startDate)} - {fmtDate(modal.item.endDate)} ({modal.item.totalDays} day{modal.item.totalDays > 1 ? "s" : ""})
                  </div>
                  <div style={{ color: SLATE, fontSize: 13 }}>{modal.item.reason}</div>
                </div>
              );
            })()}

            {/* Note */}
            <div className="mb-4">
              <label style={{ color: NAVY, fontSize: 13, fontWeight: 600 }} className="mb-1.5 block">
                {modal.action === "reject" ? "เหตุผลที่ไม่อนุมัติ *" : "หมายเหตุ (ไม่บังคับ)"}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={modal.action === "reject" ? "กรุณาระบุเหตุผล..." : "เพิ่มหมายเหตุ..."}
                required={modal.action === "reject"}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,92,255,0.15)",
                  fontSize: 14,
                  color: NAVY,
                  background: ICE,
                  resize: "vertical",
                }}
              />
            </div>

            {/* Signature pad — only for approve action */}
            {modal.action === "approve" && (
              <div className="mb-4">
                <SignaturePad
                  label="ลายเซ็นผู้อนุมัติ"
                  required
                  onSave={(base64) => setSignature(base64)}
                  onClear={() => setSignature(null)}
                />
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setModal(null)}
                className="rounded-xl px-4 py-2.5"
                style={{
                  border: "1px solid rgba(0,92,255,0.10)",
                  color: NAVY,
                  fontSize: 13,
                  fontWeight: 600,
                  background: "#FFFFFF",
                }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting || (modal.action === "approve" && !signature) || (modal.action === "reject" && !note.trim())}
                className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 disabled:opacity-50"
                style={{
                  background: modal.action === "approve" ? "#065F46" : "#991B1B",
                  color: "#FFFFFF",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {submitting && <Loader2 size={15} className="animate-spin" />}
                {modal.action === "approve" ? "ยืนยันอนุมัติ" : "ยืนยันปฏิเสธ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
