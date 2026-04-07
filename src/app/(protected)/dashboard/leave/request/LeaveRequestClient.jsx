// app/(protected)/dashboard/leave/request/LeaveRequestClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Send,
  RotateCcw,
  Upload,
  Trash2,
  Calendar,
  Clock,
  FileText,
} from "lucide-react";

/* ---------- config ---------- */
const UNLIMITED = new Set(["WFH", "ERR", "OFFSITE"]); // ประเภทที่ไม่จำกัดจำนวนครั้ง

/* ---------- helpers ---------- */
const fmtNum = (n) => new Intl.NumberFormat().format(n || 0);
const toISOShort = (d) => {
  if (!d) return "";
  const z = new Date(d);
  const yyyy = z.getFullYear();
  const mm = String(z.getMonth() + 1).padStart(2, "0");
  const dd = String(z.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const cls = (...xs) => xs.filter(Boolean).join(" ");
const range = (n) => Array.from({ length: n }, (_, i) => i);

/* ---------- main ---------- */
export default function LeaveRequestClient({ initial }) {
  const { year, me, types = [], quotas = [], usedMap = {} } = initial || {};

  /* ---- quota summary cards ---- */
  const summary = useMemo(() => {
    const qMap = new Map(
      (quotas || []).map((q) => [q.typeCode, Number(q.total || 0)])
    );
    return (types || []).map((t) => {
      const code = t.code;
      if (UNLIMITED.has(code)) {
        return {
          code,
          name: t.name || code,
          unlimited: true,
          total: null,
          used: 0,
          avail: null,
        };
      }
      const total = qMap.get(code) || 0;
      const used = Number(usedMap?.[code] || 0);
      const avail = Math.max(0, total - used);
      return {
        code,
        name: t.name || code,
        unlimited: false,
        total,
        used,
        avail,
      };
    });
  }, [types, quotas, usedMap]);

  /* ---- tabs ---- */
  const [tab, setTab] = useState("new");
  const [pendingRows, setPendingRows] = useState(null);
  const [historyRows, setHistoryRows] = useState(null);

  const tryFetch = async (paths) => {
    for (const url of paths) {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) return r.json();
    }
    throw new Error("API not found");
  };

  const fetchMine = async (status) =>
    tryFetch([
      `/api/leave/requests/mine?status=${status}`,
      `/api/leave/requests?scope=me&status=${status}`,
    ]);

  /* ---- load pending/history ครั้งแรก + ตอนมี event ---- */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [p, h] = await Promise.all([
          fetchMine("pending"),
          fetchMine("history"),
        ]);
        if (!alive) return;
        setPendingRows(p?.items || p?.rows || p || []);
        setHistoryRows(h?.items || h?.rows || h || []);
      } catch {
        if (!alive) return;
        setPendingRows([]);
        setHistoryRows([]);
      }
    };
    load();
    const onChanged = () => load();
    window.addEventListener("hrms:leave:changed", onChanged);
    return () => {
      alive = false;
      window.removeEventListener("hrms:leave:changed", onChanged);
    };
  }, []);

  /* ---------------- New Request form ---------------- */
  const firstSelectable = summary.find((b) => !b.unlimited) || summary[0];
  const [typeCode, setTypeCode] = useState(firstSelectable?.code || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!typeCode && firstSelectable?.code) setTypeCode(firstSelectable.code);
  }, [firstSelectable, typeCode]);

  // signature
  const [loadingSig, setLoadingSig] = useState(true);
  const [savedSig, setSavedSig] = useState("");
  const [useSaved, setUseSaved] = useState(true);
  const [showPad, setShowPad] = useState(false);
  const padRef = useRef(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/employees/me/signature", {
          cache: "no-store",
        });
        const j = await res.json().catch(() => ({}));
        if (!alive) return;
        setSavedSig(j?.signatureDataUrl || "");
        setUseSaved(Boolean(j?.signatureDataUrl));
        setShowPad(!j?.signatureDataUrl);
      } catch {
      } finally {
        if (alive) setLoadingSig(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onPointer = (e) => {
    const cvs = padRef.current;
    if (!cvs) return;
    const g = cvs.getContext("2d");
    const rect = cvs.getBoundingClientRect();
    const px = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    const py = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top;
    if (e.type === "pointerdown" || e.type === "touchstart") {
      setDrawing(true);
      g.beginPath();
      g.moveTo(px, py);
    } else if (
      (e.type === "pointermove" || e.type === "touchmove") &&
      drawing
    ) {
      g.lineTo(px, py);
      g.strokeStyle = "#111";
      g.lineWidth = 2;
      g.lineCap = "round";
      g.stroke();
    } else {
      setDrawing(false);
    }
  };
  const clearPad = () => {
    const cvs = padRef.current;
    if (!cvs) return;
    const g = cvs.getContext("2d");
    g.clearRect(0, 0, cvs.width, cvs.height);
  };
  const getPadDataUrl = () => {
    const cvs = padRef.current;
    if (!cvs) return "";
    return cvs.toDataURL("image/png");
  };

  const [files, setFiles] = useState([]);
  const onPickFiles = (e) => setFiles(Array.from(e.target.files || []));

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const submit = async () => {
    if (submittingRef.current) return;
    if (!typeCode || !startDate || !endDate) return alert("กรอกข้อมูลให้ครบ");

    if (!UNLIMITED.has(typeCode)) {
      const selected = summary.find((b) => b.code === typeCode);
      if (selected && selected.avail !== null && selected.avail <= 0) {
        return alert("โควต้าคงเหลือไม่พอ");
      }
    }

    let sigDataUrl = "";
    if (useSaved && savedSig) sigDataUrl = savedSig;
    else {
      sigDataUrl = getPadDataUrl();
      if (!/^data:image\/png;base64,/.test(sigDataUrl))
        return alert("กรุณาลงลายเซ็น");
    }

    const body = {
      typeCode,
      startDate,
      endDate,
      reason,
      notes,
      signatureDataUrl: sigDataUrl,
    };
    const form = new FormData();
    form.append("payload", JSON.stringify(body));
    files.forEach((f) => form.append("files", f));

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch("/api/leave/requests", {
        method: "POST",
        body: form,
        headers: {
          "x-idempotency-key":
            globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
        },
      });
      const okJson = res.headers
        .get("content-type")
        ?.includes("application/json");
      const j = okJson ? await res.json() : {};
      if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`);

      alert("ส่งคำขอเรียบร้อย");
      setReason("");
      setNotes("");
      setFiles([]);
      window.dispatchEvent(new CustomEvent("hrms:leave:changed"));
      setTab("pending");
    } catch (e) {
      alert(e.message || "ส่งคำขอล้มเหลว");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  /* ---------------- Calendar (mine) ---------------- */
  const [calY, setCalY] = useState(year || new Date().getFullYear());
  const [calM, setCalM] = useState(new Date().getMonth()); // 0..11
  const [calData, setCalData] = useState([]);

  const fetchCalendar = async (y) =>
    tryFetch([
      `/api/leave/requests/mine?status=all&year=${y}`,
      `/api/leave/requests?scope=me&status=all&year=${y}`,
    ]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = await fetchCalendar(calY);
        if (!alive) return;
        setCalData(j?.items || j?.rows || j || []);
      } catch {
        if (!alive) return;
        setCalData([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [calY]);

  /* ---------------- Filter pending เป็นของ “ฉัน” เท่านั้น ---------------- */
  const myId = me?.id ? String(me.id) : null;

  const myPending = useMemo(() => {
    const rows = pendingRows || [];
    if (!myId) return rows;

    // ถ้าไม่มีฟิลด์อ้างถึงพนักงานเลย ให้เชื่อว่า API /mine scope มาแล้ว => ไม่ต้องกรอง
    const hasEmployeeField = rows.some(
      (r) =>
        r?.employeeId != null || r?.employee?._id != null || r?.employee != null
    );
    if (!hasEmployeeField) return rows;

    // มีฟิลด์ => กรองให้เหลือเฉพาะของฉัน
    return rows.filter((r) => {
      const rid =
        r?.employeeId?._id ??
        r?.employee?._id ??
        r?.employeeId ??
        r?.employee ??
        null;
      return rid && String(rid) === myId;
    });
  }, [pendingRows, myId]);

  /* ---------------- Filter history เป็นของ “ฉัน” เท่านั้น ---------------- */
  const myHistory = useMemo(() => {
    const rows = historyRows || [];
    if (!myId) return rows;

    // ถ้าไม่มีฟิลด์อ้างพนักงานเลย ให้ถือว่า API /mine scope แล้ว -> ไม่ต้องกรอง
    const hasEmployeeField = rows.some(
      (r) =>
        r?.employeeId != null || r?.employee?._id != null || r?.employee != null
    );
    if (!hasEmployeeField) return rows;

    // มีฟิลด์ -> กรองให้เหลือของฉัน
    return rows.filter((r) => {
      const rid =
        r?.employeeId?._id ??
        r?.employee?._id ??
        r?.employeeId ??
        r?.employee ??
        null;
      return rid && String(rid) === myId;
    });
  }, [historyRows, myId]);

  /* ---------------- UI ---------------- */
  return (
    <div className="space-y-6">
      {/* header tabs */}
      <div className="grid grid-cols-4 gap-2">
        {[
          ["new", "New Request"],
          ["pending", `Pending (${myPending?.length ?? 0})`], // ← ใช้ myPending นับจำนวน
          ["history", "History"],
          ["calendar", "Calendar View"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cls(
              "rounded-xl px-4 py-2 ring-1 ring-white/10",
              tab === k
                ? "bg-indigo-600/90 text-white"
                : "bg-white/5 text-slate-200 hover:bg-white/10"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* quota cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {summary.map((b) => (
          <div
            key={b.code}
            className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4"
          >
            <div className="text-slate-200 font-medium mb-1">{b.name}</div>
            {b.unlimited ? (
              <>
                <div className="flex justify-between text-sm text-slate-400 mb-1">
                  <span>
                    Available: <b className="text-slate-200">Unlimited</b>
                  </span>
                  <span>Total: –</span>
                </div>
                <div className="h-2 rounded bg-white/10 overflow-hidden">
                  <div className="h-full" style={{ width: "0%" }} />
                </div>
                <div className="mt-1 text-xs text-slate-400">Used: –</div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm text-slate-400 mb-1">
                  <span>
                    Available:{" "}
                    <b className="text-slate-200">{fmtNum(b.avail)}</b>
                  </span>
                  <span>Total: {fmtNum(b.total)}</span>
                </div>
                <div className="h-2 rounded bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500"
                    style={{
                      width: `${
                        b.total ? Math.min(100, (b.used / b.total) * 100) : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Used: {fmtNum(b.used)}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* NEW REQUEST */}
      {tab === "new" && (
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-300">Leave Type</label>
                <select
                  value={typeCode}
                  onChange={(e) => setTypeCode(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-800 px-4 py-2.5 ring-1 ring-slate-700 text-white"
                >
                  {summary.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name}
                      {t.unlimited
                        ? " (Unlimited)"
                        : ` (${fmtNum(t.avail)} avail)`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-300">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10 text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-300">Reason</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
                placeholder="โปรดระบุเหตุผลการลา"
              />
            </div>

            <div>
              <label className="text-sm text-slate-300">
                Additional Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-slate-100"
                placeholder="บันทึกเพิ่มเติม..."
              />
            </div>

            {/* Attachments */}
            <div>
              <label className="text-sm text-slate-300">
                Attachments (optional)
              </label>
              <div className="mt-1 flex items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-slate-200 ring-1 ring-white/10 cursor-pointer">
                  <Upload size={16} /> เลือกไฟล์
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                </label>
                {files.length > 0 && (
                  <div className="text-sm text-slate-400">
                    {files.length} files selected
                  </div>
                )}
              </div>
            </div>

            {/* Signature */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm text-slate-300">Signature</label>
                {loadingSig ? (
                  <div className="mt-2 text-slate-400 text-sm">
                    กำลังโหลดลายเซ็น…
                  </div>
                ) : savedSig && useSaved && !showPad ? (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={savedSig}
                      alt="signature"
                      className="h-24 rounded bg-white"
                    />
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setUseSaved(false);
                          setShowPad(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-slate-200 ring-1 ring-white/10"
                      >
                        <RotateCcw size={16} /> เซ็นใหม่
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSavedSig("");
                          setUseSaved(false);
                          setShowPad(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 px-3 py-2 text-red-200 ring-1 ring-red-500/30"
                      >
                        <Trash2 size={16} /> ล้างค่า (ไม่ใช้ลายเซ็นเดิม)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="rounded-xl bg-white p-2 inline-block">
                      <canvas
                        ref={padRef}
                        width={560}
                        height={160}
                        className="block bg-white rounded"
                        onPointerDown={onPointer}
                        onPointerMove={onPointer}
                        onPointerUp={onPointer}
                        onPointerLeave={onPointer}
                        onTouchStart={onPointer}
                        onTouchMove={onPointer}
                        onTouchEnd={onPointer}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={clearPad}
                        className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-slate-200 ring-1 ring-white/10"
                      >
                        <RotateCcw size={16} /> ล้าง
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                <div className="text-slate-200 font-medium mb-2">
                  Approval Process
                </div>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• Submit request → Pending HoD</li>
                  <li>• HoD approves → Pending HR</li>
                  <li>• HR approves → Approved</li>
                </ul>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className={cls(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 ring-1 ring-white/10",
                  submitting
                    ? "bg-indigo-600/70 text-white pointer-events-none"
                    : "bg-indigo-600 text-white"
                )}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PENDING — ใช้ myPending */}
      {tab === "pending" && (
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
          <div className="p-5">
            <div className="text-slate-200 font-medium mb-3 flex items-center gap-2">
              <Clock size={16} /> คำขอที่รอดำเนินการ (ของฉัน)
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-300">
                  <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
                    <th>ประเภท</th>
                    <th>ช่วงวันลา</th>
                    <th>จำนวนวัน</th>
                    <th>สถานะ</th>
                    <th>เอกสาร</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {(myPending || []).length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-slate-400"
                      >
                        ไม่มีคำขอรอดำเนินการ
                      </td>
                    </tr>
                  )}
                  {(myPending || []).map((r) => (
                    <tr
                      key={r._id}
                      className="[&>td]:px-3 [&>td]:py-2 border-t border-white/10"
                    >
                      <td>{r.typeCode}</td>
                      <td>
                        {toISOShort(r.startDate)} – {toISOShort(r.endDate)}
                      </td>
                      <td>{r.durationDays}</td>
                      <td>
                        <span className="inline-flex items-center rounded-full bg-amber-500/20 text-amber-200 px-2 py-0.5">
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <a
                          className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200"
                          href={`/api/leave/requests/${r._id}/doc`}
                          target="_blank"
                        >
                          <FileText size={14} /> เปิดเอกสาร
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY (เดิม) */}
      {tab === "history" && (
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
          <div className="p-5">
            <div className="text-slate-200 font-medium mb-3">ประวัติคำขอ</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-300">
                  <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
                    <th>ประเภท</th>
                    <th>ช่วงวันลา</th>
                    <th>จำนวนวัน</th>
                    <th>สถานะ</th>
                    <th>เอกสาร</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {(myHistory || []).length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-slate-400"
                      >
                        ไม่มีประวัติคำขอ
                      </td>
                    </tr>
                  )}
                  {(myHistory || []).map((r) => {
                    const badgeCls =
                      r.status === "approved"
                        ? "bg-emerald-500/20 text-emerald-200"
                        : r.status === "rejected"
                        ? "bg-rose-500/20 text-rose-200"
                        : "bg-amber-500/20 text-amber-200";
                    return (
                      <tr
                        key={r._id}
                        className="[&>td]:px-3 [&>td]:py-2 border-t border-white/10"
                      >
                        <td>{r.typeCode}</td>
                        <td>
                          {toISOShort(r.startDate)} – {toISOShort(r.endDate)}
                        </td>
                        <td>{r.durationDays}</td>
                        <td>
                          <span
                            className={cls(
                              "inline-flex items-center rounded-full px-2 py-0.5",
                              badgeCls
                            )}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td>
                          <a
                            className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200"
                            href={`/api/leave/requests/${r._id}/doc`}
                            target="_blank"
                          >
                            <FileText size={14} /> เปิดเอกสาร
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR (เดิม) */}
      {tab === "calendar" && (
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-slate-300" />
            <select
              className="rounded-lg bg-white/10 text-slate-200 px-2 py-1 ring-1 ring-white/10"
              value={calM}
              onChange={(e) => setCalM(Number(e.target.value))}
            >
              {[
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ].map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg bg-white/10 text-slate-200 px-2 py-1 ring-1 ring-white/10"
              value={calY}
              onChange={(e) => setCalY(Number(e.target.value))}
            >
              {range(7).map((i) => {
                const y = new Date().getFullYear() - 3 + i;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </select>
          </div>

          {/* month grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {(() => {
              const first = new Date(Date.UTC(calY, calM, 1));
              const startCol = first.getUTCDay();
              const daysInMonth = new Date(
                Date.UTC(calY, calM + 1, 0)
              ).getUTCDate();
              const items = (calData || []).filter(
                (r) =>
                  new Date(r.startDate).getUTCMonth() === calM ||
                  new Date(r.endDate).getUTCMonth() === calM
              );

              const cells = [];
              for (let i = 0; i < startCol; i++)
                cells.push(<div key={`e${i}`} />);
              for (let d = 1; d <= daysInMonth; d++) {
                const cellDate = new Date(Date.UTC(calY, calM, d));
                const match = items.filter((r) => {
                  const s = new Date(r.startDate);
                  s.setUTCHours(0, 0, 0, 0);
                  const e = new Date(r.endDate);
                  e.setUTCHours(0, 0, 0, 0);
                  const cd = new Date(cellDate);
                  cd.setUTCHours(0, 0, 0, 0);
                  return cd >= s && cd <= e;
                });
                const approved = match.some((r) => r.status === "approved");
                const hasAny = match.length > 0;
                const bg = approved
                  ? "bg-emerald-500/30"
                  : hasAny
                  ? "bg-amber-500/30"
                  : "bg-white/10";
                cells.push(
                  <div
                    key={d}
                    className={cls(
                      "aspect-square rounded-md ring-1 ring-white/10 flex items-center justify-center",
                      bg
                    )}
                  >
                    <span className="text-slate-200">{d}</span>
                  </div>
                );
              }
              return cells;
            })()}
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-emerald-500/60" />{" "}
              Approved
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-amber-500/60" />{" "}
              Pending
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
