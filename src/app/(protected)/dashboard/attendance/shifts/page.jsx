"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Users,
  Star,
  Coffee,
  AlarmClock,
  Info,
} from "lucide-react";

/* ── design tokens ─────────────────────────────────── */
const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const LIME = "#D4F73F";
const SLATE = "#808A95";
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

export default function ShiftsPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', shift }
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null); // shift id being deleted

  /* ── form state ──────────────────────── */
  const [form, setForm] = useState({
    name: "",
    startTime: "08:00",
    endTime: "17:00",
    lateThresholdMinutes: 15,
    breakMinutes: 60,
    isDefault: false,
  });

  /* ── auth guard ──────────────────────── */
  const role = session?.user?.role || "employee";

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) { router.replace("/login"); return; }
    if (!["superadmin", "hr"].includes(role)) {
      router.replace("/403");
    }
  }, [session, authStatus, router, role]);

  /* ── fetch shifts ────────────────────── */
  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/shifts?all=true", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`);
      setShifts(j.data || []);
    } catch (e) {
      alert(e.message || "โหลดข้อมูลไม่สำเร็จ");
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authStatus === "authenticated" && ["superadmin", "hr"].includes(role)) {
      load();
    }
  }, [authStatus, role]);

  /* ── modal helpers ───────────────────── */
  function openCreate() {
    setForm({
      name: "",
      startTime: "08:00",
      endTime: "17:00",
      lateThresholdMinutes: 15,
      breakMinutes: 60,
      isDefault: false,
    });
    setModal({ mode: "create" });
  }

  function openEdit(shift) {
    setForm({
      name: shift.name || "",
      startTime: shift.startTime || "08:00",
      endTime: shift.endTime || "17:00",
      lateThresholdMinutes: shift.lateThresholdMinutes ?? 15,
      breakMinutes: shift.breakMinutes ?? 60,
      isDefault: shift.isDefault || false,
    });
    setModal({ mode: "edit", shift });
  }

  /* ── submit create/edit ──────────────── */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { alert("กรุณากรอกชื่อรูปแบบเวลา"); return; }

    setSaving(true);
    try {
      const isEdit = modal?.mode === "edit";
      const url = isEdit
        ? `/api/attendance/shifts/${modal.shift._id}`
        : "/api/attendance/shifts";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          startTime: form.startTime,
          endTime: form.endTime,
          lateThresholdMinutes: Number(form.lateThresholdMinutes) || 15,
          breakMinutes: Number(form.breakMinutes) || 60,
          isDefault: form.isDefault,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "บันทึกไม่สำเร็จ");

      setModal(null);
      load();
    } catch (err) {
      alert(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  /* ── delete (soft) ───────────────────── */
  async function handleDelete(shift) {
    if (!confirm(`ต้องการลบ "${shift.name}" ใช่หรือไม่?`)) return;
    setDeleting(shift._id);
    try {
      const res = await fetch(`/api/attendance/shifts/${shift._id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "ลบไม่สำเร็จ");
      load();
    } catch (err) {
      alert(err.message || "ลบไม่สำเร็จ");
    } finally {
      setDeleting(null);
    }
  }

  /* ── separate active / inactive ──────── */
  const activeShifts = useMemo(() => shifts.filter((s) => s.isActive !== false), [shifts]);
  const inactiveShifts = useMemo(() => shifts.filter((s) => s.isActive === false), [shifts]);

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
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl grid place-items-center"
            style={{ background: "rgba(0,92,255,0.08)" }}
          >
            <Clock size={20} style={{ color: BLUE }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>
              จัดการเวลาทำงาน
            </h1>
            <p className="text-sm" style={{ color: SLATE }}>
              สร้าง แก้ไข และจัดการรูปแบบเวลาทำงานของพนักงาน
            </p>
          </div>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95"
          style={{ background: BLUE, color: "#FFFFFF" }}
        >
          <Plus size={18} />
          เพิ่มเวลาทำงานใหม่
        </button>
      </header>

      {/* ── Info banner ────────────────────── */}
      <div
        style={{
          background: "rgba(0,92,255,0.06)",
          border: "1px solid rgba(0,92,255,0.15)",
          borderRadius: "10px",
          padding: "10px 16px",
          fontSize: "13px",
          color: BLUE,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <Info size={15} style={{ flexShrink: 0 }} />
        กำหนดรูปแบบเวลาทำงานสำหรับพนักงานแต่ละคน เช่น 09:00-18:00 หรือ 08:00-17:00
        สามารถกำหนดรายบุคคลได้ในหน้า &quot;กำหนดเวลาพนักงาน&quot;
      </div>

      {/* ── Loading ────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={28} className="animate-spin" style={{ color: BLUE }} />
        </div>
      )}

      {/* ── Empty state ────────────────────── */}
      {!loading && activeShifts.length === 0 && (
        <div className="text-center py-16" style={CARD}>
          <Clock size={40} style={{ color: SLATE, margin: "0 auto" }} />
          <p className="mt-3 text-sm" style={{ color: SLATE }}>
            ยังไม่มีรูปแบบเวลาทำงาน — กดปุ่ม &quot;เพิ่มเวลาทำงานใหม่&quot; เพื่อเริ่มต้น
          </p>
        </div>
      )}

      {/* ── Shift Grid ─────────────────────── */}
      {!loading && activeShifts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activeShifts.map((shift) => (
            <div
              key={shift._id}
              className="p-5 transition-all duration-200 hover:-translate-y-0.5"
              style={CARD}
            >
              {/* Top row: name + default badge */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-bold" style={{ color: NAVY }}>
                  {shift.name}
                </h3>
                {shift.isDefault && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{ background: LIME, color: NAVY }}
                  >
                    <Star size={12} />
                    Default
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm" style={{ color: NAVY }}>
                  <Clock size={15} style={{ color: BLUE }} />
                  <span className="font-medium">
                    {shift.startTime} → {shift.endTime}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: SLATE }}>
                  <AlarmClock size={15} style={{ color: SLATE }} />
                  สายหลัง {shift.lateThresholdMinutes ?? 15} นาที
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: SLATE }}>
                  <Coffee size={15} style={{ color: SLATE }} />
                  พักกลางวัน {shift.breakMinutes ?? 60} นาที
                </div>
                {typeof shift.employeeCount === "number" && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: SLATE }}>
                    <Users size={15} style={{ color: SLATE }} />
                    พนักงาน {shift.employeeCount} คน
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3" style={{ borderTop: "1px solid rgba(0,92,255,0.08)" }}>
                <button
                  onClick={() => openEdit(shift)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150"
                  style={{ color: BLUE, background: "rgba(0,92,255,0.08)" }}
                >
                  <Pencil size={14} />
                  แก้ไข
                </button>
                <button
                  onClick={() => handleDelete(shift)}
                  disabled={deleting === shift._id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150"
                  style={{ color: "#DC2626", background: "rgba(239,68,68,0.08)" }}
                >
                  {deleting === shift._id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Inactive shifts ────────────────── */}
      {!loading && inactiveShifts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: SLATE }}>
            เวลาทำงานที่ถูกปิดใช้งาน ({inactiveShifts.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {inactiveShifts.map((shift) => (
              <div
                key={shift._id}
                className="p-5 opacity-50"
                style={{ ...CARD, background: ICE }}
              >
                <h3 className="text-base font-bold mb-1" style={{ color: SLATE }}>
                  {shift.name}
                </h3>
                <p className="text-sm" style={{ color: SLATE }}>
                  {shift.startTime} → {shift.endTime}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ────────────── */}
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
                {modal.mode === "create" ? "เพิ่มรูปแบบเวลาทำงาน" : "แก้ไขเวลาทำงาน"}
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
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
                  ชื่อรูปแบบเวลา
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="เช่น มาตรฐาน (09:00-18:00), พิเศษ (08:00-17:00)"
                  required
                  style={INPUT_STYLE}
                />
              </div>

              {/* Time range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
                    เวลาเริ่ม
                  </label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    required
                    style={INPUT_STYLE}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
                    เวลาสิ้นสุด
                  </label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    required
                    style={INPUT_STYLE}
                  />
                </div>
              </div>

              {/* Late threshold + break */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
                    สายหลัง (นาที)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={form.lateThresholdMinutes}
                    onChange={(e) => setForm({ ...form, lateThresholdMinutes: e.target.value })}
                    style={INPUT_STYLE}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
                    พักกลางวัน (นาที)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={form.breakMinutes}
                    onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })}
                    style={INPUT_STYLE}
                  />
                </div>
              </div>

              {/* Is default */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: BLUE }}
                />
                <span className="text-sm font-medium" style={{ color: NAVY }}>
                  ใช้เป็นค่าเริ่มต้น
                </span>
              </label>

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
                  {modal.mode === "create" ? "เพิ่ม" : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
