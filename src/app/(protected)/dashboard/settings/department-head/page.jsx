"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canAccess } from "@/lib/rbac/access";
import { OFFSITE_STEP_DEPT_CODES } from "@/lib/offsiteRules";
import PersonAvatar from "../../../../../components/PersonAvatar";
import {
  BLUE,
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CodeChip,
  FOCUS,
  INPUT,
  LINE,
  MUTED,
  NAVY,
  NoAccountPill,
  PAGE,
  PAGE_BG,
  SLATE,
} from "../../../../../components/hr/hrUi";
import { Check, Info, Loader2, Pencil, Search, Trash2, Users, X } from "lucide-react";
import { employeeDisplayName, employeeFullNameTh } from "@/lib/employeeName";

// Thai name when present, else English (lib/employeeName.js)
const fullName = (e) => employeeFullNameTh(e) || employeeDisplayName(e) || "-";
const plainName = (e) => employeeDisplayName(e) || "-";

/** Off-site steps whose signer is this department's head (the off-site resolver's map). */
function offsiteStepsOf(code) {
  return Object.entries(OFFSITE_STEP_DEPT_CODES)
    .filter(([, c]) => c === code)
    .map(([step]) => Number(step));
}

function StagePill({ children, tone }) {
  const style = tone === "blue" ? { background: "#EEF4FF", color: BLUE } : { background: "#F1F4F8", color: SLATE };
  return (
    <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={style} data-testid="hod-stage">
      {children}
    </span>
  );
}

/**
 * Settings › กำหนดหัวหน้าแผนก. Heads live in Department.headOfDepartment (an
 * Employee); this page and the department edit form both write it through
 * lib/hod.js. Any employee may be picked; one without a login account is
 * marked because they cannot approve in the system.
 */
export default function HodSettingsPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  // [{ _id, code, name, color, head, headHasAccount }] from /api/department-head
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

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
    if (!confirm(`ต้องการล้างหัวหน้าแผนก ${modal.deptCode} หรือไม่?`)) return;

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

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return departments;
    return departments.filter((d) =>
      [d.code, d.name, d.head ? fullName(d.head) : "", d.head ? `${d.head.firstName} ${d.head.lastName}` : ""].some((v) => (v || "").toLowerCase().includes(s))
    );
  }, [departments, q]);

  if (authStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin" style={{ color: BLUE }} />
      </div>
    );
  }

  return (
    <div className={PAGE} style={PAGE_BG}>
      <div className="mx-auto max-w-[1360px] space-y-4 md:space-y-5">
        {/* ── Info ─────────────────────────────── */}
        <div className="flex gap-3 rounded-[14px] p-5 text-[14px]" style={{ background: "#EEF4FF", color: NAVY }} data-testid="hod-info">
          <Info size={18} aria-hidden className="mt-0.5 shrink-0" style={{ color: BLUE }} />
          <p>
            หัวหน้าแผนกเป็นผู้อนุมัติใบลาขั้นแรกของคนในแผนก หัวหน้าฝ่ายบัญชีและฝ่ายบุคคลยังเป็นผู้ลงนามขั้นที่ 2 และ 3 ของคำขอทำงานนอกสถานที่
            หัวหน้าแผนกไม่จำเป็นต้องมีบัญชีผู้ใช้ แต่จะลงนามในระบบไม่ได้จนกว่าจะมีบัญชี
          </p>
        </div>

        {/* ── Search ───────────────────────────── */}
        <label className="relative block">
          <span className="sr-only">ค้นหาแผนกหรือชื่อหัวหน้า</span>
          <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาแผนกหรือชื่อหัวหน้า" className={`${INPUT} pl-10`} data-testid="hod-search" />
        </label>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: BLUE }} />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center text-[14px]" style={{ border: `1px solid ${LINE}`, color: SLATE }}>
            ไม่พบข้อมูลแผนก
          </div>
        ) : (
          <>
            {/* tablet / desktop: table */}
            <div className="hidden overflow-hidden rounded-2xl bg-white md:block" style={{ border: `1px solid ${LINE}` }} data-testid="hod-table">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="text-[13px]" style={{ background: "#F8FAFD", color: SLATE }}>
                    <th className="p-4 font-semibold">แผนก</th>
                    <th className="p-4 font-semibold">หัวหน้าแผนก</th>
                    <th className="p-4 font-semibold">ใช้ในขั้นอนุมัติ</th>
                    <th className="p-4"><span className="sr-only">จัดการ</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((dept) => (
                    <tr key={dept._id} style={{ borderTop: "1px solid #EEF2F8" }} data-testid="hod-row" data-code={dept.code}>
                      <td className="p-4 align-middle"><DeptCell dept={dept} /></td>
                      <td className="p-4 align-middle"><HeadCell dept={dept} /></td>
                      <td className="p-4 align-middle"><Stages dept={dept} /></td>
                      <td className="p-4 text-right align-middle"><ActionButton dept={dept} onClick={() => openModal(dept)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* phone: cards */}
            <div className="space-y-3 md:hidden" data-testid="hod-cards">
              {rows.map((dept) => (
                <div key={dept._id} className="space-y-3 rounded-2xl bg-white p-4" style={{ border: `1px solid ${LINE}` }} data-testid="hod-card" data-code={dept.code}>
                  <DeptCell dept={dept} />
                  <HeadCell dept={dept} />
                  <Stages dept={dept} />
                  <div className="flex justify-end">
                    <ActionButton dept={dept} onClick={() => openModal(dept)} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Picker dialog ─────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13,27,42,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hod-dialog-title"
            className="flex w-full max-w-md flex-col rounded-[20px] bg-white p-5 md:p-6"
            style={{ border: `1px solid ${LINE}`, boxShadow: "0 16px 48px rgba(13,27,42,0.2)", maxHeight: "85vh" }}
            data-testid="hod-dialog"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 id="hod-dialog-title" className="text-[17px] font-bold" style={{ color: NAVY }}>
                กำหนดหัวหน้าแผนก — {modal.deptName}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="ปิด"
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] md:h-9 md:w-9 ${FOCUS}`}
                style={{ background: "#F5F8FF", color: SLATE }}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <label className="relative mb-2 block">
              <span className="sr-only">ค้นหาพนักงาน</span>
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  loadCandidates(e.target.value);
                }}
                placeholder="ค้นหาพนักงาน"
                className={`${INPUT} pl-10`}
                data-testid="hod-dialog-search"
              />
            </label>

            <p className="mb-2 text-[12px]" style={{ color: SLATE }}>แสดงพนักงานทุกคน — หัวหน้าไม่จำเป็นต้องอยู่ในแผนกนี้</p>

            <div className="mb-4 min-h-0 flex-1 overflow-y-auto rounded-xl" style={{ border: `1px solid ${LINE}`, maxHeight: 300 }}>
              {loadingCandidates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin" style={{ color: BLUE }} />
                </div>
              ) : candidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-[13px]" style={{ color: SLATE }}>
                  <Users size={24} aria-hidden style={{ opacity: 0.4, marginBottom: 8 }} />
                  ไม่พบพนักงานที่ตรงเงื่อนไข
                </div>
              ) : (
                candidates.map((emp) => {
                  const isSelected = selectedEmp?._id === emp._id;
                  return (
                    <button
                      type="button"
                      key={emp._id}
                      onClick={() => setSelectedEmp(emp)}
                      aria-pressed={isSelected}
                      className={`flex min-h-[52px] w-full items-center gap-2.5 px-3.5 py-2.5 text-left ${FOCUS}`}
                      style={{ background: isSelected ? "#EEF4FF" : "transparent", borderBottom: "1px solid #EEF2F8" }}
                      data-testid="hod-candidate"
                      data-id={emp._id}
                    >
                      <PersonAvatar src={emp.photoUrl} name={plainName(emp)} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[14px] font-semibold" style={{ color: NAVY }}>{plainName(emp)}</span>
                          {!emp.userId && <NoAccountPill />}
                        </span>
                        <span className="block text-[12px]" style={{ color: SLATE }}>
                          {[emp.department, emp.position, emp.level ? `Level ${emp.level}` : ""].filter(Boolean).join(" • ")}
                        </span>
                      </span>
                      {isSelected && <Check size={18} aria-hidden style={{ color: BLUE, flexShrink: 0 }} />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap justify-between gap-3">
              <div>
                {canClear && modal.hasHead && (
                  <button type="button" onClick={handleClear} disabled={clearing} className={BTN_DANGER} data-testid="hod-clear">
                    {clearing ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} aria-hidden />}
                    ล้างหัวหน้า
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setModal(null)} className={BTN_SECONDARY}>
                  ยกเลิก
                </button>
                <button type="button" onClick={handleSave} disabled={saving || !selectedEmp} className={BTN_PRIMARY} data-testid="hod-save">
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
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-medium text-white"
          style={{ background: toast.type === "error" ? "#991B1B" : "#065F46", boxShadow: "0 8px 32px rgba(13,27,42,0.25)" }}
          data-testid="hod-toast"
        >
          {toast.type === "error" ? <X size={16} aria-hidden /> : <Check size={16} aria-hidden />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function DeptCell({ dept }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <CodeChip code={dept.code} color={dept.color} />
      <span className="min-w-0 break-words text-[15px] font-semibold" style={{ color: NAVY }}>{dept.name}</span>
    </div>
  );
}

function HeadCell({ dept }) {
  if (!dept.head) {
    return <span className="text-[14px] font-medium" style={{ color: "#92400E" }} data-testid="hod-no-head">ยังไม่ได้กำหนด</span>;
  }
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <PersonAvatar src={dept.head.photoUrl} name={plainName(dept.head)} size={36} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="break-words text-[14px] font-semibold" style={{ color: NAVY }} data-testid="hod-head-name">{fullName(dept.head)}</span>
          {!dept.headHasAccount && <NoAccountPill />}
        </div>
        {dept.head.position && <div className="text-[12px]" style={{ color: SLATE }}>{dept.head.position}</div>}
      </div>
    </div>
  );
}

function Stages({ dept }) {
  const steps = offsiteStepsOf(dept.code);
  if (!dept.head && steps.length === 0) return <span className="text-[13px]" style={{ color: SLATE }}>—</span>;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="hod-stages">
      {dept.head && <StagePill>ใบลา</StagePill>}
      {steps.map((n) => (
        <StagePill key={n} tone="blue">นอกสถานที่ ขั้น {n}</StagePill>
      ))}
    </div>
  );
}

function ActionButton({ dept, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] bg-white px-3 text-[13px] font-semibold md:min-h-[36px] ${FOCUS}`}
      style={{ border: "1px solid #D6E0F0", color: BLUE }}
      data-testid="hod-action"
    >
      <Pencil size={14} aria-hidden /> {dept.head ? "เปลี่ยน" : "กำหนด"}
    </button>
  );
}
