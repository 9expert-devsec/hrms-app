"use client";

import { useEffect, useMemo, useState, useRef } from "react";

function cls(...xs) { return xs.filter(Boolean).join(" "); }
const fmtDR = (s,e) => {
  try {
    const a = new Date(s).toLocaleDateString();
    const b = new Date(e).toLocaleDateString();
    return `${a} - ${b}`;
  } catch { return "-"; }
};

export default function ApprovalClient() {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("pending"); // pending | approved | rejected | all

  // pagination (10/หน้า)
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const rows = (list || []).filter((r) => {
      if (!kw) return true;
      const emp = r.employee || {};
      const name = [emp.firstName, emp.lastName].filter(Boolean).join(" ").toLowerCase();
      return (
        name.includes(kw) ||
        (r.typeCode || "").toLowerCase().includes(kw) ||
        (r.status || "").toLowerCase().includes(kw)
      );
    });
    return rows;
  }, [list, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/leave/approvals/for-me?status=${status}`, { cache: "no-store" });
      const isJson = res.headers.get("content-type")?.includes("application/json");
      const j = isJson ? await res.json().catch(() => ({})) : {};
      if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`);
      setList(j.items || []);
      setPage(1);
    } catch (e) {
      alert(e.message || "โหลดรายการไม่สำเร็จ");
      setList([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [status]); // eslint-disable-line

  // ----- approve with signature -----
  const [sigOpen, setSigOpen] = useState(null); // { id, row }
  const onApproveClick = (row) => setSigOpen({ id: row._id, row });

  const onApproveWithSignature = async (signatureDataUrl) => {
    if (!sigOpen?.id) return;
    try {
      const res = await fetch(`/api/leave/requests/${sigOpen.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl }),
      });
      const j = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(j?.message || "approve failed");
      setSigOpen(null);
      await load(); // อัปเดตรายการและเอกสารล่าสุด
    } catch (e) {
      alert(e.message || "Approve ไม่สำเร็จ");
    }
  };

  async function doReject(id) {
    const reason = prompt("เหตุผลการปฏิเสธ (optional)");
    if (reason === null) return;
    try {
      const res = await fetch(`/api/leave/requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "reject failed");
      await load();
    } catch (e) {
      alert(e.message || "Reject ไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหา ชื่อพนักงาน / ประเภท / สถานะ..."
          className="flex-1 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10 text-slate-100"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10 text-slate-100"
          title="กรองสถานะ"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-slate-200 ring-1 ring-white/10 disabled:opacity-60"
        >
          Reload
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden ring-1 ring-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">พนักงาน</th>
              <th className="px-3 py-2 text-left">ประเภท</th>
              <th className="px-3 py-2 text-left">ช่วงวันลา</th>
              <th className="px-3 py-2 text-left">สถานะ</th>
              <th className="px-3 py-2 text-left">เอกสาร</th>
              <th className="px-3 py-2 text-right w-48">การทำรายการ</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-5 text-center text-slate-400">
                  {loading ? "กำลังโหลด..." : "ไม่มีคำขอที่ต้องอนุมัติ"}
                </td>
              </tr>
            )}

            {pageRows.map((req) => {
              const emp = req.employee || {};
              const full = [emp.firstName, emp.lastName].filter(Boolean).join(" ");
              return (
                <tr key={req._id} className="border-t border-white/10">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-100">{full || "-"}</div>
                    <div className="text-slate-400">{emp.position || "-"}</div>
                  </td>
                  <td className="px-3 py-2">{req.typeCode || "-"}</td>
                  <td className="px-3 py-2">{fmtDR(req.startDate, req.endDate)}</td>
                  <td className="px-3 py-2 capitalize">{req.status || "-"}</td>
                  <td className="px-3 py-2">
                    <a
                      href={`/api/leave/requests/${req._id}/doc`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-slate-200"
                    >
                      เปิดเอกสาร
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {req.status?.startsWith("pending") ? (
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => onApproveClick(req)}
                          className="rounded-lg bg-emerald-600/85 hover:bg-emerald-600 px-3 py-1.5 text-white"
                        >
                          อนุมัติ
                        </button>
                        <button
                          onClick={() => doReject(req._id)}
                          className="rounded-lg bg-rose-600/85 hover:bg-rose-600 px-3 py-1.5 text-white"
                        >
                          ปฏิเสธ
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* pager */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-slate-400 text-xs">
          แสดง {pageRows.length} จากทั้งหมด {filtered.length} รายการ
        </span>
        <button
          className="rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10 disabled:opacity-50"
          onClick={() => setPage(p => Math.max(1, p-1))}
          disabled={page <= 1}
        >
          Prev
        </button>
        <span className="px-2 py-1 rounded bg-indigo-600/80 text-white">{page}</span>
        <button
          className="rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10 disabled:opacity-50"
          onClick={() => setPage(p => Math.min(totalPages, p+1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>

      {/* signature modal */}
      {sigOpen && (
        <SignatureModal
          onClose={() => setSigOpen(null)}
          onSubmit={onApproveWithSignature}
        />
      )}
    </div>
  );
}

/* ------- Signature Modal ------- */
function SignatureModal({ onClose, onSubmit }) {
  const padRef = useRef(null);
  const [draw, setDraw] = useState(false);
  const [loadingSig, setLoadingSig] = useState(true);
  const [savedSig, setSavedSig] = useState("");
  const [useSaved, setUseSaved] = useState(true);
  const [showPad, setShowPad] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/employees/me/signature", { cache: "no-store" });
        const j = await r.json().catch(()=> ({}));
        if (!alive) return;
        setSavedSig(j?.signatureDataUrl || "");
        setUseSaved(!!j?.signatureDataUrl);
        setShowPad(!j?.signatureDataUrl);
      } catch {} finally { if (alive) setLoadingSig(false); }
    })();
    return () => { alive = false; };
  }, []);

  const onPointer = (e) => {
    const cvs = padRef.current; if (!cvs) return;
    const g = cvs.getContext("2d");
    const r = cvs.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - r.left;
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - r.top;
    if (e.type === "pointerdown" || e.type === "touchstart") {
      setDraw(true); g.beginPath(); g.moveTo(x, y);
    } else if ((e.type === "pointermove" || e.type === "touchmove") && draw) {
      g.lineTo(x, y); g.strokeStyle = "#111"; g.lineWidth = 2; g.lineCap = "round"; g.stroke();
    } else { setDraw(false); }
  };
  const clearPad = () => {
    const cvs = padRef.current; if (!cvs) return;
    const g = cvs.getContext("2d"); g.clearRect(0,0,cvs.width,cvs.height);
  };

  const submit = () => {
    let dataUrl = "";
    if (useSaved && savedSig) dataUrl = savedSig;
    else {
      const cvs = padRef.current;
      dataUrl = cvs?.toDataURL("image/png") || "";
    }
    if (!/^data:image\/png;base64,/.test(dataUrl)) return alert("กรุณาลงลายเซ็น");
    onSubmit(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-[#0b1220] ring-1 ring-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-slate-200 font-medium">ลงลายเซ็นเพื่ออนุมัติ</div>
          <button onClick={onClose} className="px-3 py-1 rounded bg-white/10 hover:bg-white/15 text-slate-200">ปิด</button>
        </div>

        {loadingSig ? (
          <div className="text-slate-400">กำลังโหลดลายเซ็น…</div>
        ) : (
          <>
            {savedSig && useSaved && !showPad ? (
              <div className="flex items-center gap-3">
                <img src={savedSig} alt="signature" className="h-24 rounded bg-white" />
                <div className="flex flex-col gap-2">
                  <button onClick={() => { setUseSaved(false); setShowPad(true); }}
                          className="rounded bg-white/10 hover:bg-white/15 px-3 py-1.5 text-slate-200">เซ็นใหม่</button>
                  <button onClick={() => { setSavedSig(""); setUseSaved(false); setShowPad(true); }}
                          className="rounded bg-rose-500/20 hover:bg-rose-500/30 px-3 py-1.5 text-rose-100">ไม่ใช้ลายเซ็นเดิม</button>
                </div>
              </div>
            ) : (
              <div>
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
                  <button onClick={clearPad} className="rounded bg-white/10 hover:bg-white/15 px-3 py-1.5 text-slate-200">ล้าง</button>
                  {!savedSig && (
                    <label className="text-slate-400 text-sm inline-flex items-center gap-2">
                      <input type="checkbox" checked={useSaved} onChange={(e)=>setUseSaved(e.target.checked)} />
                      บันทึกลายเซ็นนี้เป็นลายเซ็นหลักของฉัน (ถ้ามี API รองรับ)
                    </label>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-4 text-right">
          <button onClick={submit} className="rounded bg-emerald-600/85 hover:bg-emerald-600 px-4 py-2 text-white">
            ยืนยันอนุมัติ
          </button>
        </div>
      </div>
    </div>
  );
}
