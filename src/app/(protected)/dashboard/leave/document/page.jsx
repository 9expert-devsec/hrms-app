"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Loader2,
  Printer,
  FileText,
  Filter,
  Inbox,
  X,
  Eye,
  CalendarDays,
} from "lucide-react";
import SignatureDisplay from "./../../../../../components/SignatureDisplay";
import AttachmentViewer, { hasAttachments } from "./../../../../../components/AttachmentViewer";
import { canAccess } from "@/lib/rbac/access";
import { accountLabel } from "@/lib/deletedAccount";

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
  sick: "ลาป่วย",
  annual: "ลาพักร้อน",
  personal: "ลากิจ",
  maternity: "ลาคลอด",
  paternity: "ลาดูแลบุตร",
  other: "อื่น ๆ",
};

const TYPE_LABELS_EN = {
  sick: "Sick Leave",
  annual: "Annual Leave",
  personal: "Personal Leave",
  maternity: "Maternity Leave",
  paternity: "Paternity Leave",
  other: "Other",
};

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtDateShort(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LeaveDocumentPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "#5E6A7E", fontSize: "14px" }}>กำลังโหลดเอกสาร...</div>
        </div>
      }
    >
      <LeaveDocumentContent />
    </Suspense>
  );
}

function LeaveDocumentContent() {
  const searchParams = useSearchParams();
  const leaveId = searchParams.get("id");

  if (leaveId) {
    return <DocumentDetail id={leaveId} />;
  }
  return <DocumentList />;
}

/* ══════════════════════════════════════════════════════
   LIST VIEW — shown when no ?id param
   ══════════════════════════════════════════════════════ */
function DocumentList() {
  const { data: session, status: authStatus } = useSession();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  // Everyone's documents, not just one's own.
  const isAdmin = canAccess(session?.user, "scope_leave_documents_all");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (year) params.set("year", year);
      if (statusFilter) params.set("status", statusFilter);
      if (isAdmin) params.set("scope", "all");
      const res = await fetch(`/api/leave?${params}`);
      const j = await res.json();
      setItems(j.ok ? j.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authStatus !== "loading" && session) load();
  }, [year, statusFilter, session, authStatus]); // eslint-disable-line

  const departments = useMemo(() => {
    const s = new Set(items.map((i) => i.employeeId?.department).filter(Boolean));
    return [...s].sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (!deptFilter) return items;
    return items.filter((i) => i.employeeId?.department === deptFilter);
  }, [items, deptFilter]);

  if (authStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin" style={{ color: BLUE }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "rgba(0,92,255,0.08)", color: BLUE }}
        >
          <FileText size={22} strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{ color: NAVY, fontSize: 22, fontWeight: 700 }}>เอกสารการลา</h1>
          <p style={{ color: SLATE, fontSize: 13 }}>ดูและพิมพ์เอกสารการลาทั้งหมด</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={CARD} className="flex flex-wrap items-center gap-3 p-4">
        <Filter size={16} style={{ color: SLATE }} />

        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          style={selectStyle}
        >
          {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="">ทุกสถานะ</option>
          <option value="pending">รอ HOD อนุมัติ</option>
          <option value="hod_approved">รอ HR อนุมัติ</option>
          <option value="approved">อนุมัติแล้ว</option>
          <option value="rejected">ไม่อนุมัติ</option>
          <option value="cancelled">ยกเลิก</option>
        </select>

        {isAdmin && departments.length > 0 && (
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="">ทุกแผนก</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}

        {(statusFilter || deptFilter) && (
          <button
            onClick={() => { setStatusFilter(""); setDeptFilter(""); }}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5"
            style={{ color: BLUE, fontSize: 12, fontWeight: 500 }}
          >
            <X size={14} /> ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: BLUE }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={CARD} className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox size={48} style={{ color: SLATE, opacity: 0.4 }} />
          <p style={{ color: NAVY, fontSize: 16, fontWeight: 600, marginTop: 12 }}>ไม่พบเอกสารการลา</p>
          <p style={{ color: SLATE, fontSize: 13, marginTop: 4 }}>
            {statusFilter || deptFilter ? "ลองปรับตัวกรอง" : "ยังไม่มีเอกสารการลา"}
          </p>
        </div>
      ) : (
        <div style={{ ...CARD, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: ICE }}>
                {isAdmin && <th style={thStyle}>ชื่อพนักงาน</th>}
                {isAdmin && <th style={thStyle}>แผนก</th>}
                <th style={thStyle}>ประเภท</th>
                <th style={thStyle}>วันที่</th>
                <th style={{ ...thStyle, textAlign: "center" }}>จำนวนวัน</th>
                <th style={{ ...thStyle, textAlign: "center" }}>สถานะ</th>
                <th style={{ ...thStyle, textAlign: "center", width: 100 }}>เอกสาร</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const emp = item.employeeId || {};
                const empName = [emp.firstName, emp.lastName].filter(Boolean).join(" ") || "-";
                const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;

                return (
                  <tr key={item._id} style={{ borderBottom: "1px solid rgba(0,92,255,0.08)" }}>
                    {isAdmin && (
                      <td style={tdStyle}>
                        <span style={{ color: NAVY, fontSize: 14, fontWeight: 500 }}>{empName}</span>
                      </td>
                    )}
                    {isAdmin && (
                      <td style={tdStyle}>
                        <span style={{ color: SLATE, fontSize: 13 }}>{emp.department || "-"}</span>
                      </td>
                    )}
                    <td style={tdStyle}>
                      <span style={{ color: NAVY, fontSize: 13 }}>
                        {TYPE_LABELS_EN[item.leaveType] || item.leaveType}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className="flex items-center gap-1" style={{ color: SLATE, fontSize: 13 }}>
                        <CalendarDays size={13} />
                        {fmtDateShort(item.startDate)} - {fmtDateShort(item.endDate)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{ color: NAVY, fontSize: 13 }}>{item.totalDays}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
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
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <Link
                        href={`/dashboard/leave/document?id=${item._id}`}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5"
                        style={{
                          background: BLUE,
                          color: "#FFFFFF",
                          fontSize: 12,
                          fontWeight: 500,
                          borderRadius: 8,
                        }}
                      >
                        <Eye size={13} />
                        ดูเอกสาร
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   DETAIL VIEW — shown when ?id=[leaveId]
   ══════════════════════════════════════════════════════ */
function DocumentDetail({ id }) {
  const [leave, setLeave] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // Use the single-record endpoint to get all fields including signatures
        const res = await fetch(`/api/leave/${id}`);
        const j = await res.json();
        if (!j.ok) throw new Error(j.message);
        setLeave(j.leave);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin" style={{ color: BLUE }} />
      </div>
    );
  }

  if (error || !leave) {
    return (
      <div className="flex items-center justify-center py-24">
        <p style={{ color: "#991B1B", fontSize: 16 }}>{error || "ไม่พบข้อมูล"}</p>
      </div>
    );
  }

  const emp = leave.employeeId || {};
  const empName = [emp.firstName, emp.lastName].filter(Boolean).join(" ") || "-";

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .leave-document, .leave-document * { visibility: visible; }
          .leave-document { position: absolute; left: 0; top: 0; width: 100%; padding: 40px; }
          .no-print { display: none !important; }
          nav, header, aside, [data-sidebar], [data-topbar] { display: none !important; }
        }
      `}</style>

      <div style={{ maxWidth: 800, margin: "0 auto" }} className="space-y-4">
        {/* Buttons */}
        <div className="flex justify-between no-print">
          <Link
            href="/dashboard/leave/document"
            className="flex items-center gap-1 rounded-xl px-4 py-2.5"
            style={{
              border: "1px solid rgba(0,92,255,0.10)",
              color: NAVY,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← กลับ
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5"
            style={{
              background: BLUE,
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <Printer size={16} />
            Download PDF
          </button>
        </div>

        {/* Document */}
        <div
          className="leave-document"
          style={{
            background: "#FFFFFF",
            border: "1px solid rgba(0,92,255,0.10)",
            borderRadius: 16,
            padding: 48,
            boxShadow: "0 2px 8px rgba(13,27,42,0.06)",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h1 style={{ color: NAVY, fontSize: 28, fontWeight: 700, marginBottom: 4 }}>ใบลา</h1>
            <p style={{ color: SLATE, fontSize: 14 }}>9Expert Training</p>
            <div
              style={{
                width: 60,
                height: 3,
                background: BLUE,
                borderRadius: 2,
                margin: "12px auto 0",
              }}
            />
          </div>

          {/* Employee info */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 24,
              padding: 20,
              background: "#F8FAFD",
              borderRadius: 12,
            }}
          >
            <InfoRow label="ชื่อ-นามสกุล" value={empName} />
            <InfoRow label="รหัสพนักงาน" value={emp.empId || "-"} />
            <InfoRow label="แผนก" value={emp.department || "-"} />
            <InfoRow label="ตำแหน่ง" value={emp.position || "-"} />
          </div>

          {/* Leave details */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 24,
              padding: 20,
              background: "#F8FAFD",
              borderRadius: 12,
            }}
          >
            <InfoRow label="ประเภทการลา" value={TYPE_LABELS[leave.leaveType] || leave.leaveType} />
            <InfoRow label="สถานะ" value={(STATUS_BADGE[leave.status] || STATUS_BADGE.pending).label} />
            <InfoRow label="วันที่เริ่มลา" value={fmtDate(leave.startDate)} />
            <InfoRow label="วันที่สิ้นสุด" value={fmtDate(leave.endDate)} />
            <InfoRow label="จำนวนวัน" value={`${leave.totalDays} วัน`} />
          </div>

          {/* Reason */}
          <div style={{ marginBottom: 32 }}>
            <span style={{ color: SLATE, fontSize: 12, fontWeight: 600 }}>เหตุผลการลา</span>
            <p style={{ color: NAVY, fontSize: 14, marginTop: 4, lineHeight: 1.6 }}>{leave.reason}</p>
          </div>

          {/* Attachments */}
          {hasAttachments(leave) && (
            <div style={{ marginBottom: 24 }}>
              <AttachmentViewer leave={leave} />
            </div>
          )}

          {/* Signatures — 3 columns */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 24,
              borderTop: "1px solid rgba(0,92,255,0.10)",
              paddingTop: 24,
            }}
          >
            {/* Column 1: Employee */}
            <div>
              <SignatureDisplay
                signature={leave.employeeSignature}
                label="ลายเซ็นผู้ขอลา"
                signerName={empName}
                signedAt={leave.createdAt}
              />
            </div>

            {/* Column 2: HOD */}
            <div>
              {leave.status === "rejected" && leave.rejectedBy === "hod" ? (
                <div>
                  <span style={{ fontWeight: 600, color: NAVY, fontSize: 14 }}>หัวหน้าแผนก</span>
                  <div
                    style={{
                      marginTop: 8,
                      padding: 12,
                      borderRadius: 12,
                      background: "#FEE2E2",
                      border: "1px solid #FECACA",
                    }}
                  >
                    <span style={{ color: "#991B1B", fontSize: 13, fontWeight: 600 }}>ไม่อนุมัติ</span>
                    {leave.hodApproverNote && (
                      <p style={{ color: "#991B1B", fontSize: 13, marginTop: 4 }}>{leave.hodApproverNote}</p>
                    )}
                  </div>
                </div>
              ) : (
                <SignatureDisplay
                  signature={leave.hodSignature}
                  label="ลายเซ็นหัวหน้าแผนก"
                  signedAt={leave.hodApprovedAt}
                />
              )}
              {leave.hodApproverNote && leave.status !== "rejected" && (
                <p style={{ color: SLATE, fontSize: 12, marginTop: 4 }}>หมายเหตุ: {leave.hodApproverNote}</p>
              )}
              {leave.hodApproverId && (
                <p style={{ color: SLATE, fontSize: 12, marginTop: 4 }}>ผู้อนุมัติ: {accountLabel(leave.hodApproverId)}</p>
              )}
            </div>

            {/* Column 3: HR */}
            <div>
              {leave.status === "rejected" && leave.rejectedBy === "hr" ? (
                <div>
                  <span style={{ fontWeight: 600, color: NAVY, fontSize: 14 }}>HR</span>
                  <div
                    style={{
                      marginTop: 8,
                      padding: 12,
                      borderRadius: 12,
                      background: "#FEE2E2",
                      border: "1px solid #FECACA",
                    }}
                  >
                    <span style={{ color: "#991B1B", fontSize: 13, fontWeight: 600 }}>ไม่อนุมัติ</span>
                    {leave.hrApproverNote && (
                      <p style={{ color: "#991B1B", fontSize: 13, marginTop: 4 }}>{leave.hrApproverNote}</p>
                    )}
                  </div>
                </div>
              ) : leave.status === "pending" || (leave.status === "rejected" && leave.rejectedBy === "hod") ? (
                <div>
                  <span style={{ fontWeight: 600, color: NAVY, fontSize: 14 }}>HR</span>
                  <div
                    style={{
                      marginTop: 8,
                      width: "100%",
                      height: 100,
                      border: "2px dashed #D1D5DB",
                      borderRadius: 12,
                      background: "#F9FAFB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ color: SLATE, fontSize: 13 }}>รอดำเนินการ</span>
                  </div>
                </div>
              ) : (
                <div>
                  <SignatureDisplay
                    signature={leave.hrSignature}
                    label="ลายเซ็น HR"
                    signedAt={leave.hrApprovedAt}
                  />
                  {leave.hrApproverNote && (
                    <p style={{ color: SLATE, fontSize: 12, marginTop: 4 }}>หมายเหตุ: {leave.hrApproverNote}</p>
                  )}
                </div>
              )}
              {leave.hrApproverId && (
                <p style={{ color: SLATE, fontSize: 12, marginTop: 4 }}>ผู้อนุมัติ: {accountLabel(leave.hrApproverId)}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <span style={{ color: SLATE, fontSize: 12, fontWeight: 600 }}>{label}</span>
      <div style={{ color: NAVY, fontSize: 14, marginTop: 2 }}>{value}</div>
    </div>
  );
}

/* ── shared styles ─────────────────────────────── */
const selectStyle = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,92,255,0.15)",
  fontSize: 13,
  color: NAVY,
  background: ICE,
};

const thStyle = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 600,
  color: SLATE,
  borderBottom: "1px solid rgba(0,92,255,0.08)",
};

const tdStyle = {
  padding: "14px 16px",
  fontSize: 14,
};
