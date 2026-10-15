"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CalendarOff,
  Plus,
  Trash2,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  Calendar,
  FileSpreadsheet,
  Info,
  CheckCircle2,
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

const TYPE_BADGE = {
  public:  { bg: "#DBEAFE", color: "#1E40AF", label: "วันหยุดราชการ" },
  company: { bg: "#EDE9FE", color: "#5B21B6", label: "วันหยุดบริษัท" },
};

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function fmtDateFull(d) {
  return new Date(d).toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function parseCSVPreview(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const obj = {};
    headers.forEach((h, i) => (obj[h] = values[i]));
    return obj;
  }).filter((r) => r.date && r.name);
}

export default function HolidaysPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  /* ── add modal ───────────────────────── */
  const [modal, setModal] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("public");
  const [saving, setSaving] = useState(false);

  /* ── CSV import modal ────────────────── */
  const [importModal, setImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  /* ── auth guard ──────────────────────── */
  const role = session?.user?.role || "employee";

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) { router.replace("/login"); return; }
    if (!["superadmin", "hr"].includes(role)) router.replace("/403");
  }, [session, authStatus, router, role]);

  /* ── fetch holidays ──────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/holidays?year=${year}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`);
      setHolidays(j.data || []);
    } catch {
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (authStatus === "authenticated" && ["superadmin", "hr"].includes(role)) load();
  }, [authStatus, role, load]);

  /* ── group by month ──────────────────── */
  const grouped = useMemo(() => {
    const map = {};
    for (const h of holidays) {
      const m = new Date(h.date).getMonth();
      if (!map[m]) map[m] = [];
      map[m].push(h);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    return map;
  }, [holidays]);

  const sortedMonths = useMemo(() =>
    Object.keys(grouped).map(Number).sort((a, b) => a - b),
  [grouped]);

  /* ── add single holiday ──────────────── */
  function openAdd() {
    setFormDate("");
    setFormName("");
    setFormType("public");
    setModal(true);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!formDate || !formName.trim()) { alert("กรุณากรอกวันที่และชื่อวันหยุด"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/attendance/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: formDate, name: formName.trim(), type: formType }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "เพิ่มไม่สำเร็จ");
      setModal(false);
      load();
    } catch (err) {
      alert(err.message || "เพิ่มไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  /* ── delete holiday ──────────────────── */
  async function handleDelete(id, name) {
    if (!confirm(`ต้องการลบวันหยุด "${name}" ใช่หรือไม่?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/attendance/holidays/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "ลบไม่สำเร็จ");
      load();
    } catch (err) {
      alert(err.message || "ลบไม่สำเร็จ");
    } finally {
      setDeleting(null);
    }
  }

  /* ── CSV file selected ───────────────── */
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result || "";
      const rows = parseCSVPreview(text);
      setCsvPreview(rows);
    };
    reader.readAsText(file);
  }

  /* ── CSV upload ──────────────────────── */
  async function handleImportCSV() {
    if (!csvFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", csvFile);
      const res = await fetch("/api/attendance/holidays", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "นำเข้าไม่สำเร็จ");
      setImportResult({ ok: true, inserted: j.inserted || 0, updated: j.updated || 0, total: j.total || 0 });
      load();
    } catch (err) {
      setImportResult({ ok: false, message: err.message });
    } finally {
      setImporting(false);
    }
  }

  function openImportModal() {
    setCsvFile(null);
    setCsvPreview([]);
    setImportResult(null);
    setImportModal(true);
    if (fileRef.current) fileRef.current.value = "";
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
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl grid place-items-center"
            style={{ background: "rgba(0,92,255,0.08)" }}
          >
            <CalendarOff size={20} style={{ color: BLUE }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>
              วันหยุดนักขัตฤกษ์
            </h1>
            <p className="text-sm" style={{ color: SLATE }}>
              จัดการวันหยุดราชการและวันหยุดบริษัท
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/api/attendance/holidays/template?year=${year}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 no-underline"
            style={{ color: BLUE, border: `1px solid ${BLUE}`, background: "transparent" }}
          >
            <Download size={16} />
            Download Template
          </a>
          <button
            onClick={openImportModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: ICE, color: NAVY, border: "1px solid rgba(0,92,255,0.12)" }}
          >
            <Upload size={16} />
            Import จาก CSV
          </button>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95"
            style={{ background: BLUE, color: "#FFFFFF" }}
          >
            <Plus size={18} />
            เพิ่มวันหยุด
          </button>
        </div>
      </header>

      {/* ── Year Navigation ────────────────── */}
      <div className="flex items-center justify-center gap-4" style={{ ...CARD, padding: "12px 20px" }}>
        <button
          onClick={() => setYear((y) => y - 1)}
          className="p-2 rounded-lg transition-colors duration-150"
          style={{ color: NAVY, background: ICE }}
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-base font-bold" style={{ color: NAVY }}>
          ปี {year} ({year + 543})
        </h2>
        <button
          onClick={() => setYear((y) => y + 1)}
          className="p-2 rounded-lg transition-colors duration-150"
          style={{ color: NAVY, background: ICE }}
        >
          <ChevronRight size={18} />
        </button>
        <span className="text-sm" style={{ color: SLATE }}>
          · {holidays.length} วันหยุด
        </span>
      </div>

      {/* ── Loading ────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin" style={{ color: BLUE }} />
        </div>
      )}

      {/* ── Empty state ────────────────────── */}
      {!loading && holidays.length === 0 && (
        <div className="text-center py-16" style={CARD}>
          <CalendarOff size={40} style={{ color: SLATE, margin: "0 auto" }} />
          <p className="mt-3 text-sm" style={{ color: SLATE }}>
            ยังไม่มีวันหยุดสำหรับปี {year}
          </p>
          <p className="text-xs mt-1" style={{ color: SLATE }}>
            กด &quot;Download Template&quot; เพื่อดาวน์โหลดตัวอย่าง แล้ว Import เข้าระบบ
          </p>
        </div>
      )}

      {/* ── Holiday Timeline ───────────────── */}
      {!loading && sortedMonths.map((m) => (
        <div key={m}>
          <h3
            className="text-sm font-bold mb-2 flex items-center gap-2"
            style={{ color: NAVY }}
          >
            <Calendar size={14} style={{ color: BLUE }} />
            {THAI_MONTHS[m]}
            <span className="text-xs font-normal" style={{ color: SLATE }}>
              ({grouped[m].length} วัน)
            </span>
          </h3>

          <div className="space-y-2 mb-6">
            {grouped[m].map((h) => {
              const badge = TYPE_BADGE[h.type] || TYPE_BADGE.public;
              return (
                <div
                  key={h._id}
                  className="flex items-center justify-between p-4 transition-all duration-200 hover:-translate-y-0.5"
                  style={CARD}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="h-11 w-11 rounded-xl grid place-items-center shrink-0"
                      style={{ background: badge.bg }}
                    >
                      <span className="text-sm font-bold" style={{ color: badge.color }}>
                        {new Date(h.date).getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: NAVY }}>
                        {h.name}
                      </p>
                      <p className="text-xs" style={{ color: SLATE }}>
                        {fmtDateFull(h.date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                    <button
                      onClick={() => handleDelete(h._id, h.name)}
                      disabled={deleting === h._id}
                      className="p-1.5 rounded-lg transition-colors duration-150"
                      style={{ color: "#DC2626", background: "rgba(239,68,68,0.08)" }}
                    >
                      {deleting === h._id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── Add Holiday Modal ──────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13,27,42,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}
        >
          <div
            className="w-full max-w-md overflow-y-auto"
            style={{ background: "#FFFFFF", borderRadius: 16, boxShadow: "0 16px 48px rgba(13,27,42,0.2)", maxHeight: "90vh" }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid rgba(0,92,255,0.08)" }}
            >
              <h3 className="text-lg font-bold" style={{ color: NAVY }}>เพิ่มวันหยุด</h3>
              <button onClick={() => setModal(false)} className="p-1 rounded-lg" style={{ color: SLATE }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: NAVY }}>วันที่</label>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required style={INPUT_STYLE} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: NAVY }}>ชื่อวันหยุด</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="เช่น วันสงกรานต์" required style={INPUT_STYLE} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: NAVY }}>ประเภท</label>
                <div className="flex gap-3">
                  {[
                    { value: "public", label: "วันหยุดราชการ", color: "#1E40AF", bg: "#DBEAFE" },
                    { value: "company", label: "วันหยุดบริษัท", color: "#5B21B6", bg: "#EDE9FE" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-150"
                      style={{
                        background: formType === opt.value ? opt.bg : ICE,
                        border: formType === opt.value ? `2px solid ${opt.color}` : "2px solid transparent",
                      }}
                    >
                      <input type="radio" name="holidayType" value={opt.value} checked={formType === opt.value} onChange={(e) => setFormType(e.target.value)} className="sr-only" />
                      <span className="text-sm font-semibold" style={{ color: formType === opt.value ? opt.color : SLATE }}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ color: SLATE, background: ICE }}>ยกเลิก</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 disabled:opacity-60" style={{ background: BLUE, color: "#FFFFFF" }}>
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  เพิ่มวันหยุด
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CSV Import Modal ───────────────── */}
      {importModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13,27,42,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setImportModal(false); }}
        >
          <div
            className="w-full max-w-lg overflow-y-auto"
            style={{ background: "#FFFFFF", borderRadius: 16, boxShadow: "0 16px 48px rgba(13,27,42,0.2)", maxHeight: "90vh" }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid rgba(0,92,255,0.08)" }}
            >
              <h3 className="text-lg font-bold" style={{ color: NAVY }}>
                <FileSpreadsheet size={18} className="inline mr-2" style={{ color: BLUE }} />
                นำเข้าวันหยุดจาก CSV
              </h3>
              <button onClick={() => setImportModal(false)} className="p-1 rounded-lg" style={{ color: SLATE }}>
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Instructions */}
              <div className="space-y-1.5 text-sm" style={{ color: SLATE }}>
                <p>1. กด <b style={{ color: NAVY }}>Download Template</b> เพื่อดาวน์โหลดไฟล์ตัวอย่าง</p>
                <p>2. แก้ไขวันหยุดตามต้องการใน Excel หรือ Google Sheets</p>
                <p>3. บันทึกเป็น CSV แล้วอัพโหลดที่นี่</p>
              </div>

              {/* Tips */}
              <div
                className="flex items-start gap-2 p-3 rounded-xl"
                style={{ background: "rgba(0,92,255,0.06)", border: "1px solid rgba(0,92,255,0.12)" }}
              >
                <Info size={15} style={{ color: BLUE, marginTop: 2, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: BLUE }}>
                  ลบแถวที่ไม่ต้องการออกได้เลย เช่น บริษัทไม่ได้หยุดวันจักรี ก็ลบแถวนั้นออก
                  เพิ่มวันหยุดบริษัทเองได้โดยใช้ type=company
                  วันที่ซ้ำจะอัพเดทอัตโนมัติ ไม่เกิดข้อมูลซ้ำ
                </p>
              </div>

              {/* Column format */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: ICE }}>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: NAVY }}>คอลัมน์</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: NAVY }}>ตัวอย่าง</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: NAVY }}>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(0,92,255,0.06)" }}>
                      <td className="px-3 py-1.5 font-medium" style={{ color: NAVY }}>date</td>
                      <td className="px-3 py-1.5" style={{ color: SLATE }}>2026-04-13</td>
                      <td className="px-3 py-1.5" style={{ color: SLATE }}>YYYY-MM-DD</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(0,92,255,0.06)" }}>
                      <td className="px-3 py-1.5 font-medium" style={{ color: NAVY }}>name</td>
                      <td className="px-3 py-1.5" style={{ color: SLATE }}>วันสงกรานต์</td>
                      <td className="px-3 py-1.5" style={{ color: SLATE }}>ชื่อวันหยุด</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-medium" style={{ color: NAVY }}>type</td>
                      <td className="px-3 py-1.5" style={{ color: SLATE }}>public / company</td>
                      <td className="px-3 py-1.5" style={{ color: SLATE }}>ราชการ หรือ บริษัท</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* File input */}
              <div
                className="flex flex-col items-center justify-center p-6 rounded-xl cursor-pointer transition-colors duration-150"
                style={{
                  border: "2px dashed rgba(0,92,255,0.2)",
                  background: csvFile ? "rgba(0,92,255,0.04)" : ICE,
                }}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {csvFile ? (
                  <>
                    <FileSpreadsheet size={24} style={{ color: BLUE }} />
                    <p className="text-sm font-semibold mt-2" style={{ color: NAVY }}>{csvFile.name}</p>
                    <p className="text-xs" style={{ color: SLATE }}>{csvPreview.length} รายการ</p>
                  </>
                ) : (
                  <>
                    <Upload size={24} style={{ color: SLATE }} />
                    <p className="text-sm mt-2" style={{ color: SLATE }}>คลิกเพื่อเลือกไฟล์ .csv</p>
                  </>
                )}
              </div>

              {/* Preview */}
              {csvPreview.length > 0 && (
                <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(0,92,255,0.08)" }}>
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr style={{ background: ICE }}>
                        <th className="px-3 py-2 text-left font-semibold" style={{ color: NAVY }}>วันที่</th>
                        <th className="px-3 py-2 text-left font-semibold" style={{ color: NAVY }}>ชื่อ</th>
                        <th className="px-3 py-2 text-left font-semibold" style={{ color: NAVY }}>ประเภท</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 5).map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(0,92,255,0.06)" }}>
                          <td className="px-3 py-1.5" style={{ color: NAVY }}>{r.date}</td>
                          <td className="px-3 py-1.5" style={{ color: NAVY }}>{r.name}</td>
                          <td className="px-3 py-1.5">
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                              style={{
                                background: r.type === "company" ? "#EDE9FE" : "#DBEAFE",
                                color: r.type === "company" ? "#5B21B6" : "#1E40AF",
                              }}
                            >
                              {r.type || "public"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {csvPreview.length > 5 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-1.5 text-center" style={{ color: SLATE }}>
                            ... และอีก {csvPreview.length - 5} รายการ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Import result */}
              {importResult && (
                <div
                  className="flex items-center gap-2 p-3 rounded-xl text-sm"
                  style={{
                    background: importResult.ok ? "#D1FAE5" : "#FEE2E2",
                    color: importResult.ok ? "#065F46" : "#991B1B",
                  }}
                >
                  {importResult.ok ? <CheckCircle2 size={16} /> : <X size={16} />}
                  {importResult.ok
                    ? `นำเข้าสำเร็จ ${importResult.total} รายการ (ใหม่ ${importResult.inserted}, อัพเดท ${importResult.updated})`
                    : importResult.message}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setImportModal(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ color: SLATE, background: ICE }}
                >
                  {importResult?.ok ? "ปิด" : "ยกเลิก"}
                </button>
                {!importResult?.ok && (
                  <button
                    onClick={handleImportCSV}
                    disabled={importing || !csvFile || csvPreview.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 disabled:opacity-60"
                    style={{ background: LIME, color: NAVY }}
                  >
                    {importing ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Upload size={15} />
                    )}
                    {importing ? "กำลังนำเข้า..." : `นำเข้า ${csvPreview.length} รายการ`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
