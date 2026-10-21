"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canAccess } from "@/lib/rbac/access";
import NoAccountBadge from "../../../../../components/NoAccountBadge";
import Avatar from "../../../../../components/Avatar";
import {
  ShieldCheck,
  Users,
  Search,
  Pencil,
  Trash2,
  Loader2,
  X,
  Check,
  User,
} from "lucide-react";
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

// Thai name when present, else English (lib/employeeName.js)
const fullName = (e) => employeeDisplayName(e) || "-";

/**
 * Settings › กำหนด HOD. Heads live in Department.headOfDepartment (an
 * Employee); this page and the department edit form both write it through
 * lib/hod.js. Any employee may be picked; one without a login account gets
 * a warning badge because they cannot approve in the system.
 */
export default function HodSettingsPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  // [{ _id, code, name, color, head, headHasAccount }] from /api/department-head
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── modal state ───────────────────────── */
  const [modal, setModal] = useState(null); // { departmentId, deptCode, deptName, hasHead }
  const [candidates, setCandidates] = useState([]);
  const [searchQ, setSearchQ] = useState("");
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  /* ── toast ─────────────────────────────── */
  const [toast, setToast] = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  /* ── role gate ─────────────────────────── */
  // Registry check (src/lib/rbac); the middleware already enforces it.
  const allowed = canAccess(session?.user, "hod_settings");
  // Clearing a head stays superadmin-only (the API enforces it too).
  const canClear = session?.user?.isSuperadmin === true;

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) { router.replace("/login"); return; }
    if (!allowed) {
      router.replace("/403");
    }
  }, [session, authStatus, router, allowed]);

  /* ── fetch data ────────────────────────── */
  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/department-head", { cache: "no-store" });
      const j = await res.json();
      setDepartments(j.ok ? j.items : []);
    } catch {
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authStatus !== "loading" && session && allowed) {
      loadData();
    }
  }, [session, authStatus]); // eslint-disable-line

  /* ── fetch candidates (all employees) ──── */
  async function loadCandidates(query) {
    setLoadingCandidates(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const res = await fetch(`/api/employees/head-candidates?${params}`);
      const j = await res.json();
      setCandidates(j.items || []);
    } catch {
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }

  /* ── open modal ────────────────────────── */
  function openModal(dept) {
    setModal({
      departmentId: dept._id,
      deptCode: dept.code,
      deptName: dept.name,
      hasHead: !!dept.head,
    });
    setSelectedEmp(null);
    setSearchQ("");
    loadCandidates("");
  }

  /* ── save HOD ──────────────────────────── */
  async function handleSave() {
    if (!selectedEmp || !modal) return;

    setSaving(true);
    try {
      const res = await fetch("/api/department-head", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: modal.departmentId,
          employeeId: selectedEmp._id,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Error");
      setModal(null);
      showToast("บันทึกสำเร็จ");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  /* ── clear HOD (superadmin) ────────────── */
  async function handleClear() {
    if (!modal) return;
    if (!confirm(`ต้องการล้าง HOD ของแผนก ${modal.deptCode} หรือไม่?`)) return;

    setClearing(true);
    try {
      const res = await fetch(`/api/department-head/${modal.departmentId}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Error");
      setModal(null);
      showToast("ล้างหัวหน้าแผนกแล้ว");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setClearing(false);
    }
  }

  if (authStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin" style={{ color: BLUE }} />
      </div>
    );
  }

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
          <h1 style={{ color: NAVY, fontSize: 22, fontWeight: 700 }}>กำหนด Head of Department</h1>
          <p style={{ color: SLATE, fontSize: 13 }}>ระบุผู้รับผิดชอบอนุมัติการลาของแต่ละแผนก</p>
        </div>
      </div>

      {/* ── Table ─────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: BLUE }} />
        </div>
      ) : (
        <div style={{ ...CARD, overflowX: "auto" /* own horizontal scroll: a narrow screen scrolls the table, not the page */ }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: ICE }}>
                <th style={thStyle}>แผนก</th>
                <th style={thStyle}>HOD ปัจจุบัน</th>
                <th style={{ ...thStyle, textAlign: "center", width: 100 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept._id} style={{ borderBottom: "1px solid rgba(0,92,255,0.08)" }}>
                  <td style={tdStyle}>
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{
                          background: dept.color ? `${dept.color}18` : "rgba(0,92,255,0.08)",
                          color: dept.color || BLUE,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {dept.code}
                      </div>
                      <span style={{ color: NAVY, fontSize: 14, fontWeight: 600 }}>{dept.name}</span>
                    </div>
                  </td>

                  <td style={tdStyle}>
                    {dept.head ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-full"
                          style={{ background: "rgba(0,92,255,0.08)", color: BLUE }}
                        >
                          <User size={13} />
                        </div>
                        <span style={{ color: NAVY, fontSize: 13, fontWeight: 500 }}>
                          {fullName(dept.head)}
                        </span>
                        {dept.head.empAutoId != null && (
                          <span style={{ color: SLATE, fontSize: 11 }}>#{dept.head.empAutoId}</span>
                        )}
                        {!dept.headHasAccount && <NoAccountBadge />}
                      </div>
                    ) : (
                      <span
                        className="inline-flex rounded-full px-2.5 py-0.5"
                        style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11, fontWeight: 600 }}
                      >
                        ยังไม่ได้กำหนด
                      </span>
                    )}
                  </td>

                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <button
                      onClick={() => openModal(dept)}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5"
                      style={{
                        border: `1px solid ${BLUE}20`,
                        color: BLUE,
                        fontSize: 12,
                        fontWeight: 500,
                        background: `${BLUE}08`,
                        cursor: "pointer",
                      }}
                    >
                      <Pencil size={13} />
                      แก้ไข
                    </button>
                  </td>
                </tr>
              ))}

              {departments.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", padding: 40, color: SLATE }}>
                    ไม่พบข้อมูลแผนก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit Modal ────────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13,27,42,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 16px 48px rgba(13,27,42,0.2)",
              maxHeight: "80vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: NAVY, fontSize: 18, fontWeight: 700 }}>
                กำหนด HOD — แผนก {modal.deptCode}
              </h3>
              <button
                onClick={() => setModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: ICE, color: SLATE, cursor: "pointer", border: "none" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search
                size={16}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: SLATE }}
              />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  loadCandidates(e.target.value);
                }}
                placeholder="ค้นหาพนักงาน..."
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 36px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,92,255,0.15)",
                  fontSize: 14,
                  color: NAVY,
                  background: ICE,
                  outline: "none",
                }}
              />
            </div>

            <p style={{ color: SLATE, fontSize: 12, marginBottom: 8 }}>
              แสดงพนักงานทุกคน — หัวหน้าไม่จำเป็นต้องอยู่ในแผนกนี้
            </p>

            {/* Candidates list */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                border: "1px solid rgba(0,92,255,0.08)",
                borderRadius: 10,
                marginBottom: 16,
                maxHeight: 280,
              }}
            >
              {loadingCandidates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin" style={{ color: BLUE }} />
                </div>
              ) : candidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8" style={{ color: SLATE, fontSize: 13 }}>
                  <Users size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
                  ไม่พบพนักงานที่ตรงเงื่อนไข
                </div>
              ) : (
                candidates.map((emp) => {
                  const isSelected = selectedEmp?._id === emp._id;
                  const empName = fullName(emp);
                  return (
                    <div
                      key={emp._id}
                      onClick={() => setSelectedEmp(emp)}
                      style={{
                        padding: "10px 14px",
                        cursor: "pointer",
                        background: isSelected ? `${BLUE}0A` : "transparent",
                        borderBottom: "1px solid rgba(0,92,255,0.06)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {emp.photoUrl ? (
                        <Avatar src={emp.photoUrl} alt={empName} size={32} />
                      ) : (
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{ background: "rgba(0,92,255,0.08)", color: BLUE }}
                        >
                          <User size={14} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: NAVY, fontSize: 14, fontWeight: 500 }}>{empName}</div>
                        <div style={{ color: SLATE, fontSize: 12 }}>
                          {emp.department} • {emp.position} • Level {emp.level}
                        </div>
                        {!emp.userId && <NoAccountBadge className="mt-1" />}
                      </div>
                      {isSelected && <Check size={18} style={{ color: BLUE, flexShrink: 0 }} />}
                    </div>
                  );
                })
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-between">
              <div>
                {canClear && modal.hasHead && (
                  <button
                    onClick={handleClear}
                    disabled={clearing}
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 disabled:opacity-50"
                    style={{
                      background: "#FEE2E2",
                      color: "#991B1B",
                      fontSize: 13,
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {clearing ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    ล้างหัวหน้า
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setModal(null)}
                  className="rounded-xl px-4 py-2.5"
                  style={{
                    border: "1px solid rgba(0,92,255,0.10)",
                    color: NAVY,
                    fontSize: 13,
                    fontWeight: 600,
                    background: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !selectedEmp}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 disabled:opacity-50"
                  style={{
                    background: BLUE,
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    cursor: selectedEmp ? "pointer" : "not-allowed",
                  }}
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-5 py-3"
          style={{
            background: toast.type === "error" ? "#991B1B" : "#065F46",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 500,
            boxShadow: "0 8px 32px rgba(13,27,42,0.25)",
          }}
        >
          {toast.type === "error" ? <X size={16} /> : <Check size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

/* ── table styles ─────────────────────────────── */
const thStyle = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 600,
  color: "#5E6A7E",
  borderBottom: "1px solid rgba(0,92,255,0.08)",
};

const tdStyle = {
  padding: "14px 16px",
  fontSize: 14,
};
