"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canAccess } from "@/lib/rbac/access";
import Avatar from "../../../../../components/Avatar";
import {
  Users,
  Search,
  X,
  Loader2,
  ArrowRightLeft,
  Calendar,
  Building2,
  Clock,
  UserCircle,
  ChevronLeft,
  ChevronRight,
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

const PAGE_SIZE = 15;

export default function AssignShiftPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [assignments, setAssignments] = useState([]); // current shift assignments
  const [loading, setLoading] = useState(true);

  /* ── filter state ────────────────────── */
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [page, setPage] = useState(1);

  /* ── modal state ─────────────────────── */
  const [modal, setModal] = useState(null); // { employee, currentShift? }
  const [modalShiftId, setModalShiftId] = useState("");
  const [modalDate, setModalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  /* ── auth guard ──────────────────────── */
  // Registry check (src/lib/rbac); the middleware already enforces it.
  const allowed = canAccess(session?.user, "shift_assign");

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) { router.replace("/login"); return; }
    if (!allowed) {
      router.replace("/403");
    }
  }, [session, authStatus, router, allowed]);

  /* ── fetch data ──────────────────────── */
  async function load() {
    setLoading(true);
    try {
      const [empRes, shiftRes, assignRes] = await Promise.all([
        fetch("/api/employees", { cache: "no-store" }),
        fetch("/api/attendance/shifts", { cache: "no-store" }),
        fetch("/api/attendance/employee-shift/all", { cache: "no-store" }),
      ]);

      const empJ = await empRes.json().catch(() => ({}));
      const shiftJ = await shiftRes.json().catch(() => ({}));
      const assignJ = await assignRes.json().catch(() => ({}));

      setEmployees(empJ.employees || empJ.items || empJ.data || []);
      setShifts(shiftJ.data || []);
      setAssignments(assignJ.assignments || assignJ.data || []);
    } catch (e) {
      alert(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authStatus === "authenticated" && allowed) {
      load();
    }
  }, [authStatus, allowed]);

  /* ── derived data ────────────────────── */
  const assignmentMap = useMemo(() => {
    const map = {};
    for (const a of assignments) {
      const empId = typeof a.employeeId === "object" ? a.employeeId?._id : a.employeeId;
      if (empId) map[String(empId)] = a;
    }
    return map;
  }, [assignments]);

  const departments = useMemo(() => {
    const set = new Set(employees.map((e) => e.department).filter(Boolean));
    return Array.from(set).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return employees.filter((emp) => {
      if (deptFilter && emp.department !== deptFilter) return false;
      if (shiftFilter) {
        const assign = assignmentMap[String(emp._id)];
        const shiftId = assign?.shiftId?._id || assign?.shiftId;
        if (shiftFilter === "__none__") {
          if (shiftId) return false;
        } else {
          if (String(shiftId) !== shiftFilter) return false;
        }
      }
      if (kw) {
        const full = `${emp.firstName} ${emp.lastName} ${emp.nickName || ""} ${emp.empAutoId || ""}`.toLowerCase();
        if (!full.includes(kw)) return false;
      }
      return true;
    });
  }, [employees, q, deptFilter, shiftFilter, assignmentMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  /* ── modal helpers ───────────────────── */
  function openAssign(emp) {
    const assign = assignmentMap[String(emp._id)];
    const currentShiftId = assign?.shiftId?._id || assign?.shiftId || "";
    setModalShiftId(String(currentShiftId));
    setModalDate(new Date().toISOString().slice(0, 10));
    setModal({ employee: emp, currentShift: assign });
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!modalShiftId) { alert("กรุณาเลือกเวลาทำงาน"); return; }
    if (!modalDate) { alert("กรุณาเลือกวันที่มีผล"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/attendance/employee-shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: modal.employee._id,
          shiftId: modalShiftId,
          effectiveDate: modalDate,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "มอบหมายไม่สำเร็จ");

      setModal(null);
      load();
    } catch (err) {
      alert(err.message || "มอบหมายไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  /* ── helpers ─────────────────────────── */
  function getShiftName(empId) {
    const assign = assignmentMap[String(empId)];
    if (!assign) return null;
    if (assign.shiftId && typeof assign.shiftId === "object") {
      return assign.shiftId.name;
    }
    const shift = shifts.find((s) => String(s._id) === String(assign.shiftId));
    return shift?.name || null;
  }

  function getShiftTime(empId) {
    const assign = assignmentMap[String(empId)];
    if (!assign) return null;
    if (assign.shiftId && typeof assign.shiftId === "object") {
      return `${assign.shiftId.startTime} - ${assign.shiftId.endTime}`;
    }
    const shift = shifts.find((s) => String(s._id) === String(assign.shiftId));
    return shift ? `${shift.startTime} - ${shift.endTime}` : null;
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
          <Users size={20} style={{ color: BLUE }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: NAVY }}>
            กำหนดเวลาทำงาน
          </h1>
          <p className="text-sm" style={{ color: SLATE }}>
            กำหนดรูปแบบเวลาทำงานให้แต่ละพนักงาน
          </p>
        </div>
      </header>

      {/* ── Filters ────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3" style={{ ...CARD, padding: "16px" }}>
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            style={{ color: SLATE, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="ค้นหาชื่อพนักงาน..."
            style={{ ...INPUT_STYLE, paddingLeft: 36 }}
          />
        </div>

        {/* Department filter */}
        <div className="min-w-[160px]">
          <select
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            style={INPUT_STYLE}
          >
            <option value="">ทุกแผนก</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Shift filter */}
        <div className="min-w-[160px]">
          <select
            value={shiftFilter}
            onChange={(e) => { setShiftFilter(e.target.value); setPage(1); }}
            style={INPUT_STYLE}
          >
            <option value="">ทุกเวลาทำงาน</option>
            <option value="__none__">ยังไม่ได้กำหนด</option>
            {shifts.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Count */}
        <span className="text-xs font-medium" style={{ color: SLATE }}>
          {filtered.length} คน
        </span>
      </div>

      {/* ── Loading ────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={28} className="animate-spin" style={{ color: BLUE }} />
        </div>
      )}

      {/* ── Table ──────────────────────────── */}
      {!loading && (
        <div style={CARD} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr style={{ background: ICE, borderBottom: "1px solid rgba(0,92,255,0.08)" }}>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: NAVY }}>
                    พนักงาน
                  </th>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: NAVY }}>
                    แผนก
                  </th>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: NAVY }}>
                    เวลาทำงานปัจจุบัน
                  </th>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: NAVY }}>
                    เวลา
                  </th>
                  <th className="text-right px-5 py-3 font-semibold" style={{ color: NAVY }}>
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12" style={{ color: SLATE }}>
                      ไม่พบพนักงาน
                    </td>
                  </tr>
                )}
                {pageRows.map((emp) => {
                  const shiftName = getShiftName(emp._id);
                  const shiftTime = getShiftTime(emp._id);

                  return (
                    <tr
                      key={emp._id}
                      className="transition-colors duration-100"
                      style={{ borderBottom: "1px solid rgba(0,92,255,0.06)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,92,255,0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Employee */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {emp.photoUrl ? (
                            <Avatar src={emp.photoUrl} size={32} style={{ border: "2px solid rgba(0,92,255,0.10)" }} />
                          ) : (
                            <div
                              className="h-8 w-8 rounded-full grid place-items-center"
                              style={{ background: "rgba(0,92,255,0.08)" }}
                            >
                              <UserCircle size={18} style={{ color: BLUE }} />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold" style={{ color: NAVY }}>
                              {emp.firstName} {emp.lastName}
                            </p>
                            {emp.empAutoId && (
                              <p className="text-xs" style={{ color: SLATE }}>
                                {emp.empAutoId}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="px-5 py-3">
                        <span className="text-sm" style={{ color: NAVY }}>
                          {emp.department || "-"}
                        </span>
                      </td>

                      {/* Current shift */}
                      <td className="px-5 py-3">
                        {shiftName ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            style={{ background: "rgba(0,92,255,0.08)", color: BLUE }}
                          >
                            <Clock size={12} />
                            {shiftName}
                          </span>
                        ) : (
                          <span
                            className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            style={{ background: "#FEF3C7", color: "#92400E" }}
                          >
                            ยังไม่ได้กำหนด
                          </span>
                        )}
                      </td>

                      {/* Shift time */}
                      <td className="px-5 py-3">
                        <span className="text-sm" style={{ color: shiftTime ? NAVY : SLATE }}>
                          {shiftTime || "-"}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => openAssign(emp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 hover:-translate-y-0.5"
                          style={{ color: BLUE, background: "rgba(0,92,255,0.08)" }}
                        >
                          <ArrowRightLeft size={14} />
                          เปลี่ยนเวลาทำงาน
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: "1px solid rgba(0,92,255,0.08)" }}
            >
              <span className="text-xs" style={{ color: SLATE }}>
                แสดง {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} จาก {filtered.length} คน
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg transition-colors duration-150 disabled:opacity-40"
                  style={{ color: NAVY, background: page <= 1 ? "transparent" : ICE }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-3 py-1 rounded-lg text-xs font-bold" style={{ background: BLUE, color: "#FFFFFF" }}>
                  {page}
                </span>
                <span className="text-xs" style={{ color: SLATE }}>/ {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg transition-colors duration-150 disabled:opacity-40"
                  style={{ color: NAVY, background: page >= totalPages ? "transparent" : ICE }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Assign Shift Modal ─────────────── */}
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
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid rgba(0,92,255,0.08)" }}
            >
              <h3 className="text-lg font-bold" style={{ color: NAVY }}>
                กำหนดเวลาทำงาน
              </h3>
              <button
                onClick={() => setModal(null)}
                className="p-1 rounded-lg transition-colors duration-150"
                style={{ color: SLATE }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleAssign} className="px-6 py-5 space-y-4">
              {/* Employee info (read-only) */}
              <div
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: ICE }}
              >
                {modal.employee.photoUrl ? (
                  <Avatar src={modal.employee.photoUrl} size={40} style={{ border: "2px solid rgba(0,92,255,0.10)" }} />
                ) : (
                  <div
                    className="h-10 w-10 rounded-full grid place-items-center"
                    style={{ background: "rgba(0,92,255,0.12)" }}
                  >
                    <UserCircle size={22} style={{ color: BLUE }} />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm" style={{ color: NAVY }}>
                    {modal.employee.firstName} {modal.employee.lastName}
                  </p>
                  <p className="text-xs" style={{ color: SLATE }}>
                    {modal.employee.department} · {modal.employee.position || ""}
                  </p>
                </div>
              </div>

              {/* Current shift display */}
              {modal.currentShift && (
                <div className="text-xs" style={{ color: SLATE }}>
                  เวลาทำงานปัจจุบัน:{" "}
                  <span className="font-semibold" style={{ color: NAVY }}>
                    {typeof modal.currentShift.shiftId === "object"
                      ? modal.currentShift.shiftId.name
                      : shifts.find((s) => String(s._id) === String(modal.currentShift.shiftId))?.name || "-"}
                  </span>
                </div>
              )}

              {/* Select shift */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
                  <Clock size={14} className="inline mr-1.5" style={{ color: BLUE }} />
                  เลือกเวลาทำงานใหม่
                </label>
                <select
                  value={modalShiftId}
                  onChange={(e) => setModalShiftId(e.target.value)}
                  required
                  style={INPUT_STYLE}
                >
                  <option value="">-- เลือกเวลาทำงาน --</option>
                  {shifts
                    .filter((s) => s.isActive !== false)
                    .map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.startTime} - {s.endTime})
                      </option>
                    ))}
                </select>
              </div>

              {/* Effective date */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
                  <Calendar size={14} className="inline mr-1.5" style={{ color: BLUE }} />
                  วันที่มีผล
                </label>
                <input
                  type="date"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  required
                  style={INPUT_STYLE}
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150"
                  style={{ color: SLATE, background: ICE }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 disabled:opacity-60"
                  style={{ background: BLUE, color: "#FFFFFF" }}
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  กำหนดเวลาทำงาน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
