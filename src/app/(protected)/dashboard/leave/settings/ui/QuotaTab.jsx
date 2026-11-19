"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Lock, RotateCcw } from "lucide-react";
import PersonAvatar from "../../../../../../components/PersonAvatar";
import { BLUE, BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, FOCUS, INPUT, LINE, NAVY, SLATE } from "../../../../../../components/hr/hrUi";
import { fiscalYearLabel, fiscalYearRangeTh, validateQuota } from "@/lib/leaveRules";
import Dialog from "./Dialog";
import { EmployeeFilter, FieldLabel, SectionCard, callApi, filterEmployees, fmtDays } from "./shared";

const cellKey = (employeeId, typeId) => `${employeeId}:${typeId}`;
const toMap = (list) => new Map(list.map((r) => [cellKey(r.employeeId, r.leaveTypeId), r.quotaDays]));

/** ตั้งค่าการลา › โควตาวันลา — quota per employee × active leave type × fiscal year. */
export default function QuotaTab({ types, employees, departments, filter, setFilter, notify, currentFiscalYear, fiscalYearStartMonth, initialEntitlements }) {
  const [fy, setFy] = useState(currentFiscalYear);
  const [records, setRecords] = useState(() => toMap(initialEntitlements)); // key → quotaDays (null = no limit)
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // { employee, type }
  const [bulk, setBulk] = useState(null); // type
  const [saved, setSaved] = useState(null); // cell key just saved
  const loadedFy = useRef(currentFiscalYear);
  const active = useMemo(() => types.filter((t) => t.isActive), [types]);
  const rows = useMemo(() => filterEmployees(employees, filter), [employees, filter]);
  const readOnly = fy < currentFiscalYear;

  useEffect(() => {
    if (loadedFy.current === fy) return;
    let cancelled = false;
    setLoading(true);
    callApi(`/api/leave-settings/entitlements?fiscalYear=${fy}`)
      .then((j) => {
        if (cancelled) return;
        loadedFy.current = fy;
        setRecords(toMap(j.entitlements));
      })
      .catch((e) => !cancelled && notify(e.message, "error"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [fy, notify]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  const cell = (e, t) => {
    const key = cellKey(e._id, t._id);
    const has = records.has(key);
    return { key, has, value: has ? records.get(key) : t.defaultQuotaDays };
  };

  /** Save one cell; the grid changes first and reverts on failure. */
  async function saveCell(e, t, next) {
    const { key, has, value } = cell(e, t);
    const before = new Map(records);
    setRecords((m) => {
      const n = new Map(m);
      if (next === "reset") n.delete(key);
      else n.set(key, next);
      return n;
    });
    setEditing(null);
    try {
      if (next === "reset") {
        await callApi(`/api/leave-settings/entitlements?employeeId=${e._id}&leaveTypeId=${t._id}&fiscalYear=${fy}`, { method: "DELETE" });
      } else {
        await callApi("/api/leave-settings/entitlements", { method: "PUT", body: { employeeId: e._id, leaveTypeId: t._id, fiscalYear: fy, quotaDays: next } });
      }
      setSaved(key);
    } catch (err) {
      setRecords(before);
      notify(`${e.name} · ${t.nameTh}: ${err.message} (คืนค่าเดิม ${has ? fmtDays(value) : "ค่าเริ่มต้น"})`, "error");
    }
  }

  async function applyDefault() {
    const t = bulk;
    try {
      const j = await callApi("/api/leave-settings/entitlements", { method: "POST", body: { action: "reset-type", leaveTypeId: t._id, fiscalYear: fy } });
      setRecords((m) => new Map([...m].filter(([k]) => !k.endsWith(`:${t._id}`))));
      notify(`ใช้ค่าเริ่มต้นของ “${t.nameTh}” กับทุกคนแล้ว (ล้าง ${j.removed} รายการ)`);
      setBulk(null);
    } catch (e) {
      notify(e.message, "error");
    }
  }

  const renderCell = (e, t) => {
    const { key, has, value } = cell(e, t);
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={() => setEditing({ employee: e, type: t })}
        aria-label={`โควตา${t.nameTh}ของ ${e.name}: ${fmtDays(value)}${has ? "" : " (ค่าเริ่มต้น)"}`}
        className={`inline-flex min-h-[44px] w-full items-center justify-between gap-1 rounded-[10px] px-2.5 text-left text-[14px] disabled:cursor-default md:min-h-[40px] ${readOnly ? "" : "hover:bg-[#F5F8FF]"} ${FOCUS}`}
        style={{ border: `1px solid ${has ? "#D6E0F0" : "transparent"}`, color: has ? NAVY : "#8592A6" }}
        data-testid="quota-cell"
        data-employee={e._id}
        data-type={t._id}
        data-custom={has ? "1" : "0"}
        data-value={value === null ? "unlimited" : String(value)}
      >
        <span className="min-w-0">
          <span className="font-semibold">{fmtDays(value)}</span>
          {!has && <span className="block text-[11px]">ค่าเริ่มต้น</span>}
        </span>
        {saved === key && <Check size={15} aria-label="บันทึกแล้ว" style={{ color: "#16A34A" }} data-testid="quota-saved" />}
      </button>
    );
  };

  const years = [currentFiscalYear - 1, currentFiscalYear, currentFiscalYear + 1];

  return (
    <SectionCard title="โควตาวันลา" testid="leave-quota">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="sm:w-80">
          <FieldLabel htmlFor="quota-year">ปีงบประมาณ</FieldLabel>
          <select id="quota-year" value={fy} onChange={(e) => setFy(Number(e.target.value))} className={INPUT} data-testid="quota-year">
            {years.map((y) => (
              <option key={y} value={y}>
                {`${fiscalYearLabel(y)}${y < currentFiscalYear ? " (ดูอย่างเดียว)" : y === currentFiscalYear ? " (ปัจจุบัน)" : " (ปีถัดไป)"}`}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[13px] sm:pb-3" style={{ color: SLATE }}>{fiscalYearRangeTh(fy, fiscalYearStartMonth)}</p>
        {loading && <Loader2 size={18} className="animate-spin sm:mb-3" style={{ color: BLUE }} aria-label="กำลังโหลด" />}
      </div>
      {readOnly && (
        <p className="mb-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px]" style={{ background: "#F1F4F8", color: SLATE }} data-testid="quota-readonly">
          <Lock size={15} aria-hidden /> ปีงบประมาณที่ผ่านมา — ดูได้อย่างเดียว
        </p>
      )}
      <p className="mb-3 text-[13px]" style={{ color: SLATE }}>
        ตัวเลขสีเทา = ค่าเริ่มต้นของประเภทการลา · คลิกที่ช่องเพื่อกำหนดเฉพาะคน
      </p>
      <div className="mb-4">
        <EmployeeFilter filter={filter} setFilter={setFilter} departments={departments} />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl p-8 text-center text-[14px]" style={{ border: `1px solid ${LINE}`, color: SLATE }}>ไม่พบพนักงานที่ตรงกับการค้นหา</p>
      ) : (
        <>
          {/* tablet / desktop */}
          <div className="hidden overflow-x-auto rounded-xl md:block" style={{ border: `1px solid ${LINE}` }} data-testid="quota-table">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="align-top text-[13px]" style={{ background: "#F8FAFD", color: SLATE }}>
                  <th className="px-3 py-3 font-semibold">พนักงาน</th>
                  {active.map((t) => (
                    <th key={t._id} className="min-w-[140px] px-3 py-3 font-semibold">
                      <span className="block" style={{ color: NAVY }}>{t.nameTh}</span>
                      <span className="block font-normal">ค่าเริ่มต้น {fmtDays(t.defaultQuotaDays)}</span>
                      {!readOnly && (
                        <button type="button" onClick={() => setBulk(t)} className={`mt-1 inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 text-[12px] font-medium ${FOCUS}`} style={{ background: "#F5F8FF", color: BLUE }} data-testid="quota-bulk" data-type={t._id}>
                          <RotateCcw size={13} aria-hidden /> ใช้ค่าเริ่มต้นกับทุกคน
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e._id} style={{ borderTop: "1px solid #EEF2F8" }} data-testid="quota-row" data-id={e._id}>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[200px] items-center gap-2.5">
                        <PersonAvatar src={e.photoUrl} crop={e.photoCrop} name={e.name} size={32} />
                        <div className="min-w-0">
                          <div className="text-[14px] font-semibold" style={{ color: NAVY }}>{e.name}</div>
                          <div className="truncate text-[12px]" style={{ color: SLATE }}>{[e.departmentCode, e.position].filter(Boolean).join(" • ")}</div>
                        </div>
                      </div>
                    </td>
                    {active.map((t) => (
                      <td key={t._id} className="px-2 py-2">{renderCell(e, t)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* phone */}
          <div className="space-y-3 md:hidden">
            {!readOnly && active.length > 0 && (
              <details className="rounded-xl p-3 text-[13px]" style={{ border: `1px solid ${LINE}`, color: NAVY }}>
                <summary className="min-h-[36px] cursor-pointer font-medium">ใช้ค่าเริ่มต้นกับทุกคน…</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {active.map((t) => (
                    <button key={t._id} type="button" onClick={() => setBulk(t)} className={BTN_SECONDARY} data-testid="quota-bulk-phone" data-type={t._id}>
                      {t.nameTh}
                    </button>
                  ))}
                </div>
              </details>
            )}
            {rows.map((e) => (
              <div key={e._id} className="space-y-2 rounded-xl p-4" style={{ border: `1px solid ${LINE}` }} data-testid="quota-card" data-id={e._id}>
                <div className="flex items-center gap-2.5">
                  <PersonAvatar src={e.photoUrl} crop={e.photoCrop} name={e.name} size={36} />
                  <div className="min-w-0">
                    <div className="break-words text-[15px] font-semibold" style={{ color: NAVY }}>{e.name}</div>
                    <div className="truncate text-[12px]" style={{ color: SLATE }}>{[e.departmentCode, e.position].filter(Boolean).join(" • ")}</div>
                  </div>
                </div>
                <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-x-3 gap-y-1">
                  {active.map((t) => (
                    <div key={t._id} className="contents">
                      <dt className="text-[13px]" style={{ color: SLATE }}>{t.nameTh}</dt>
                      <dd className="min-w-0">{renderCell(e, t)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && <QuotaDialog editing={editing} cell={cell(editing.employee, editing.type)} fy={fy} onClose={() => setEditing(null)} onSave={(v) => saveCell(editing.employee, editing.type, v)} />}

      {bulk && (
        <Dialog
          title="ใช้ค่าเริ่มต้นกับทุกคน"
          onClose={() => setBulk(null)}
          testid="quota-bulk-dialog"
          footer={
            <>
              <button type="button" onClick={() => setBulk(null)} className={BTN_SECONDARY}>ยกเลิก</button>
              <button type="button" onClick={applyDefault} className={BTN_DANGER} data-testid="quota-bulk-confirm">ใช้ค่าเริ่มต้น</button>
            </>
          }
        >
          <p className="text-[14px]" style={{ color: NAVY }}>
            ล้างโควตาที่กำหนดเฉพาะคนของ “{bulk.nameTh}” ในปีงบประมาณ {fiscalYearLabel(fy)} ทั้งหมด — ทุกคนจะใช้ค่าเริ่มต้น {fmtDays(bulk.defaultQuotaDays)}
          </p>
        </Dialog>
      )}
    </SectionCard>
  );
}

function QuotaDialog({ editing, cell, fy, onClose, onSave }) {
  const { employee, type } = editing;
  const [unlimited, setUnlimited] = useState(cell.value === null);
  const [value, setValue] = useState(cell.value === null ? "" : String(cell.value));
  const [error, setError] = useState("");

  function save() {
    const checked = validateQuota(unlimited ? null : value);
    if (checked.error) return setError(checked.error);
    onSave(checked.value);
  }

  return (
    <Dialog
      title={`โควตา${type.nameTh} — ${employee.name}`}
      onClose={onClose}
      testid="quota-dialog"
      width={420}
      footer={
        <>
          {cell.has && (
            <button type="button" onClick={() => onSave("reset")} className={`${BTN_SECONDARY} mr-auto`} data-testid="quota-reset">
              <RotateCcw size={15} aria-hidden /> รีเซ็ตเป็นค่าเริ่มต้น
            </button>
          )}
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>ยกเลิก</button>
          <button type="button" onClick={save} className={BTN_PRIMARY} data-testid="quota-save">บันทึก</button>
        </>
      }
    >
      <p className="mb-3 text-[13px]" style={{ color: SLATE }}>
        ปีงบประมาณ {fiscalYearLabel(fy)} · ค่าเริ่มต้นของประเภทนี้ {fmtDays(type.defaultQuotaDays)}
        {!cell.has && " (ตอนนี้ใช้ค่าเริ่มต้น)"}
      </p>
      <FieldLabel htmlFor="quota-input" hint="(ทีละ 0.5 วัน)">โควตา (วัน)</FieldLabel>
      <input
        id="quota-input"
        type="number"
        min={0}
        max={366}
        step={0.5}
        inputMode="decimal"
        autoFocus
        disabled={unlimited}
        value={unlimited ? "" : value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        className={`${INPUT} disabled:bg-[#F5F7FB]`}
        data-testid="quota-input"
      />
      <label className="mt-2 inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px]" style={{ color: NAVY }}>
        <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} className="h-4 w-4 accent-[#005CFF]" data-testid="quota-unlimited" />
        ไม่จำกัด
      </label>
      {error && <p role="alert" className="mt-2 text-[14px] font-medium" style={{ color: "#B91C1C" }} data-testid="quota-error">{error}</p>}
    </Dialog>
  );
}
