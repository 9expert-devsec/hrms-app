// src/app/(protected)/dashboard/leave/entitlements/EntitlementsClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, RefreshCcw } from "lucide-react";

const thisYear = new Date().getFullYear();

export default function EntitlementsClient({ employees }) {
  const [employeeId, setEmployeeId] = useState(employees?.[0]?._id || "");
  const [year, setYear] = useState(thisYear);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedEmp = useMemo(
    () => employees.find((e) => e._id === employeeId),
    [employees, employeeId]
  );

  async function load() {
    if (!employeeId) return;
    setLoading(true);
    try {
      const url = `/api/leave/entitlements?employeeId=${employeeId}&year=${year}`;
      const res = await fetch(url);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "Load failed");
      setRows(j.rows || []);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, year]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/leave/entitlements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, year, rows }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "Save failed");
      await load();
      alert("บันทึกแล้ว");
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="mt-1 rounded-xl bg-slate-800 px-4 py-2.5 ring-1 ring-slate-700 text-white"
        >
          {employees.map((e) => (
            <option key={e._id} value={e._id}>
              {e.name} {e.level ? `• L${e.level}` : ""} — {e.position || "-"}
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="mt-1 rounded-xl bg-slate-800 px-4 py-2.5 ring-1 ring-slate-700 text-white"
        >
          {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-slate-200 ring-1 ring-white/10"
        >
          <RefreshCcw size={16} /> โหลดใหม่
        </button>

        <div className="ml-auto" />

        <button
          type="button"
          onClick={save}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 px-4 py-2.5 text-white ring-1 ring-white/10 disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save size={16} />}
          บันทึก
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-14 text-center text-slate-300">
          <Loader2 className="inline size-5 animate-spin mr-2" />
          กำลังโหลด…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="text-slate-300">
                <th className="text-left p-2">ประเภท</th>
                <th className="text-right p-2">โควตา/ปี</th>
                <th className="text-right p-2">ยกมา</th>
                <th className="text-right p-2">ใช้ไป</th>
                <th className="text-right p-2">คงเหลือ</th>
                <th className="text-right p-2">นับครั้ง</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.typeCode} className="border-t border-white/10">
                  <td className="p-2">
                    <div className="inline-flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ background: r.color }}
                      />
                      <span className="text-slate-100">{r.typeName}</span>
                      <span className="text-xs text-slate-400">({r.typeCode})</span>
                    </div>
                  </td>

                  <td className="p-2 text-right">
                    {r.countable ? (
                      <input
                        type="number"
                        className="w-24 text-right rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10 text-slate-100"
                        value={r.allocated ?? 0}
                        onChange={(e) =>
                          setRows((s) =>
                            s.map((x, i) => (i === idx ? { ...x, allocated: Number(e.target.value) } : x))
                          )
                        }
                      />
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>

                  <td className="p-2 text-right">
                    {r.countable ? (
                      <input
                        type="number"
                        className="w-24 text-right rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10 text-slate-100"
                        value={r.carryForward ?? 0}
                        onChange={(e) =>
                          setRows((s) =>
                            s.map((x, i) => (i === idx ? { ...x, carryForward: Number(e.target.value) } : x))
                          )
                        }
                      />
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>

                  <td className="p-2 text-right">{r.countable ? r.used ?? 0 : <span className="text-slate-500">-</span>}</td>
                  <td className="p-2 text-right">{r.countable ? r.balance ?? 0 : <span className="text-slate-500">-</span>}</td>
                  <td className="p-2 text-right">{!r.countable ? r.count ?? 0 : <span className="text-slate-500">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected employee summary */}
      {selectedEmp && (
        <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3 text-slate-300 text-xs">
          ปรับสิทธิวันลาให้: <b className="text-slate-100">{selectedEmp.name}</b>{" "}
          {selectedEmp.position ? `• ${selectedEmp.position}` : ""}{" "}
          {selectedEmp.level ? `• L${selectedEmp.level}` : ""}
        </div>
      )}
    </div>
  );
}
