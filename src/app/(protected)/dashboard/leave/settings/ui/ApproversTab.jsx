"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Pencil, UserRoundPlus, X } from "lucide-react";
import PersonAvatar from "../../../../../../components/PersonAvatar";
import { BLUE, BTN_PRIMARY, BTN_SECONDARY, FOCUS, LINE, NAVY, SLATE } from "../../../../../../components/hr/hrUi";
import { APPROVER_MODE_LABELS, approverMode, normalizeApprovers } from "@/lib/leaveRules";
import Dialog from "./Dialog";
import EmployeePicker from "./EmployeePicker";
import { EmployeeFilter, SectionCard, callApi, filterEmployees } from "./shared";

const NO_ACCOUNT = "ผู้อนุมัติยังไม่มีบัญชี — อนุมัติในระบบไม่ได้";
const MODE_STYLE = {
  auto: { background: "#FEF3C7", color: "#92400E" },
  single: { background: "#EEF4FF", color: "#1D4ED8" },
  either: { background: "#DCFCE7", color: "#166534" },
};

/** ตั้งค่าการลา › ผู้อนุมัติ — who approves each employee's leave. */
export default function ApproversTab({ employees, setEmployees, departments, filter, setFilter, notify }) {
  const [editing, setEditing] = useState(null);
  const byId = useMemo(() => new Map(employees.map((e) => [e._id, e])), [employees]);
  const rows = useMemo(() => filterEmployees(employees, filter), [employees, filter]);
  const counts = useMemo(() => {
    const c = { auto: 0, single: 0, either: 0 };
    for (const e of employees) c[approverMode(e.approver1Id, e.approver2Id)] += 1;
    return c;
  }, [employees]);

  return (
    <SectionCard title="ผู้อนุมัติการลา" testid="leave-approvers">
      <p className="mb-3 text-[13px]" style={{ color: SLATE }}>
        ไม่มีผู้อนุมัติ = อนุมัติอัตโนมัติ (ฝ่ายบุคคลยังเห็นใบลา) · ผู้อนุมัติคนเดียว = คนนั้นอนุมัติ · สองคน = คนใดคนหนึ่งอนุมัติ อีกคนรับทราบ (ไม่ต้องรอ)
      </p>
      <p className="mb-3 flex flex-wrap gap-2 text-[13px]" data-testid="approver-counts">
        {Object.keys(APPROVER_MODE_LABELS).map((m) => (
          <span key={m} className="rounded-full px-2.5 py-0.5 font-semibold" style={MODE_STYLE[m]} data-mode={m} data-count={counts[m]}>
            {APPROVER_MODE_LABELS[m]} {counts[m]}
          </span>
        ))}
      </p>
      <div className="mb-4">
        <EmployeeFilter filter={filter} setFilter={setFilter} departments={departments} />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl p-8 text-center text-[14px]" style={{ border: `1px solid ${LINE}`, color: SLATE }} data-testid="approver-empty">ไม่พบพนักงานที่ตรงกับการค้นหา</p>
      ) : (
        <>
          {/* tablet / desktop */}
          <div className="hidden overflow-hidden rounded-xl md:block" style={{ border: `1px solid ${LINE}` }}>
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col />
                <col className="w-[24%]" />
                <col className="w-[24%]" />
                <col className="w-[150px]" />
                <col className="w-[64px]" />
              </colgroup>
              <thead>
                <tr className="text-[13px]" style={{ background: "#F8FAFD", color: SLATE }}>
                  <th className="px-3 py-3 font-semibold">พนักงาน</th>
                  <th className="px-3 py-3 font-semibold">ผู้อนุมัติ 1</th>
                  <th className="px-3 py-3 font-semibold">ผู้อนุมัติ 2</th>
                  <th className="px-3 py-3 font-semibold">การอนุมัติ</th>
                  <th className="px-3 py-3"><span className="sr-only">แก้ไข</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e._id} style={{ borderTop: "1px solid #EEF2F8" }} data-testid="approver-row" data-id={e._id} data-mode={approverMode(e.approver1Id, e.approver2Id)}>
                    <td className="px-3 py-3"><Person e={e} /></td>
                    <td className="px-3 py-3"><ApproverName person={byId.get(e.approver1Id)} slot={1} /></td>
                    <td className="px-3 py-3"><ApproverName person={byId.get(e.approver2Id)} slot={2} /></td>
                    <td className="px-3 py-3"><ModePill e={e} /></td>
                    <td className="px-3 py-3 text-right"><EditButton e={e} onClick={() => setEditing(e)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* phone */}
          <div className="space-y-3 md:hidden">
            {rows.map((e) => (
              <div key={e._id} className="space-y-3 rounded-xl p-4" style={{ border: `1px solid ${LINE}` }} data-testid="approver-card" data-id={e._id}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1"><Person e={e} /></div>
                  <EditButton e={e} onClick={() => setEditing(e)} />
                </div>
                <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-[13px]">
                  <dt style={{ color: SLATE }}>ผู้อนุมัติ 1</dt>
                  <dd className="min-w-0"><ApproverName person={byId.get(e.approver1Id)} slot={1} /></dd>
                  <dt style={{ color: SLATE }}>ผู้อนุมัติ 2</dt>
                  <dd className="min-w-0"><ApproverName person={byId.get(e.approver2Id)} slot={2} /></dd>
                </dl>
                <ModePill e={e} />
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <ApproverDialog
          employee={editing}
          employees={employees}
          byId={byId}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEmployees((list) => list.map((x) => (x._id === editing._id ? { ...x, approver1Id: saved.approver1Id, approver2Id: saved.approver2Id } : x)));
            notify(`บันทึกผู้อนุมัติของ ${editing.name} แล้ว`);
            setEditing(null);
          }}
        />
      )}
    </SectionCard>
  );
}

function Person({ e }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <PersonAvatar src={e.photoUrl} crop={e.photoCrop} name={e.name} size={36} />
      <div className="min-w-0">
        <div className="break-words text-[14px] font-semibold" style={{ color: NAVY }} data-testid="approver-employee">{e.name}</div>
        <div className="truncate text-[12px]" style={{ color: SLATE }}>{[e.departmentCode, e.position].filter(Boolean).join(" • ")}</div>
      </div>
    </div>
  );
}

function ApproverName({ person, slot }) {
  if (!person) return <span className="text-[14px]" style={{ color: "#8592A6" }} data-testid={`approver-${slot}`} data-id="">—</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[14px]" style={{ color: NAVY }} data-testid={`approver-${slot}`} data-id={person._id}>
      <span className="min-w-0 break-words">{person.name}</span>
      {!person.hasAccount && (
        <span title={NO_ACCOUNT} aria-label={NO_ACCOUNT} className="inline-flex shrink-0" data-testid="approver-no-account">
          <AlertTriangle size={15} aria-hidden style={{ color: "#B45309" }} />
        </span>
      )}
    </span>
  );
}

function ModePill({ e }) {
  const mode = approverMode(e.approver1Id, e.approver2Id);
  return (
    <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={MODE_STYLE[mode]} data-testid="approver-mode" data-mode={mode}>
      {APPROVER_MODE_LABELS[mode]}
    </span>
  );
}

function EditButton({ e, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={`แก้ไขผู้อนุมัติของ ${e.name}`} className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] md:h-9 md:w-9 ${FOCUS}`} style={{ background: "#F5F8FF", color: BLUE }} data-testid="approver-edit">
      <Pencil size={16} aria-hidden />
    </button>
  );
}

function ApproverDialog({ employee, employees, byId, onClose, onSaved }) {
  const [pair, setPair] = useState({ a1: employee.approver1Id, a2: employee.approver2Id });
  const [picking, setPicking] = useState(null); // 1 | 2
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const norm = normalizeApprovers(pair.a1, pair.a2);
  const mode = approverMode(pair.a1, pair.a2);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const j = await callApi(`/api/leave-settings/approvers/${employee._id}`, { method: "PUT", body: { approver1Id: pair.a1 || null, approver2Id: pair.a2 || null } });
      onSaved(j);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  const slot = (n) => {
    const id = n === 1 ? pair.a1 : pair.a2;
    const p = id ? byId.get(id) : null;
    return (
      <div className="rounded-xl p-3" style={{ border: `1px solid ${LINE}` }} data-testid={`approver-slot-${n}`}>
        <p className="mb-2 text-[13px] font-medium" style={{ color: SLATE }}>ผู้อนุมัติ {n}</p>
        <div className="flex flex-wrap items-center gap-2">
          {p ? (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <PersonAvatar src={p.photoUrl} crop={p.photoCrop} name={p.name} size={32} />
              <span className="min-w-0">
                <span className="block break-words text-[14px] font-semibold" style={{ color: NAVY }} data-testid={`approver-slot-${n}-name`}>{p.name}</span>
                {!p.hasAccount && <span className="block text-[12px]" style={{ color: "#B45309" }}>{NO_ACCOUNT}</span>}
              </span>
            </span>
          ) : (
            <span className="flex-1 text-[14px]" style={{ color: "#8592A6" }}>ยังไม่ได้เลือก</span>
          )}
          <button type="button" onClick={() => setPicking(n)} className={BTN_SECONDARY} data-testid={`approver-pick-${n}`}>
            <UserRoundPlus size={16} aria-hidden /> {p ? "เปลี่ยน" : "เลือก"}
          </button>
          {p && (
            <button type="button" onClick={() => setPair((x) => ({ ...x, [n === 1 ? "a1" : "a2"]: null }))} className={BTN_SECONDARY} data-testid={`approver-clear-${n}`}>
              <X size={16} aria-hidden /> ล้าง
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog
      title={`ผู้อนุมัติการลาของ ${employee.name}`}
      onClose={onClose}
      testid="approver-dialog"
      width={520}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>ยกเลิก</button>
          <button type="button" onClick={save} disabled={saving} className={BTN_PRIMARY} data-testid="approver-save">
            {saving && <Loader2 size={15} className="animate-spin" aria-hidden />} บันทึก
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {slot(1)}
        {slot(2)}
        <p className="text-[13px]" style={{ color: NAVY }} data-testid="approver-dialog-mode">
          ผล: <b>{APPROVER_MODE_LABELS[mode]}</b>
          {mode === "single" && pair.a2 && !pair.a1 && " (ผู้อนุมัติ 2 จะถูกบันทึกเป็นผู้อนุมัติ 1)"}
          {pair.a1 && pair.a1 === pair.a2 && " (เลือกคนเดียวกันสองช่อง — บันทึกเป็นผู้อนุมัติ 1 คนเดียว)"}
        </p>
        {error && <p role="alert" className="text-[14px] font-medium" style={{ color: "#B91C1C" }} data-testid="approver-error">{error}</p>}
      </div>
      {picking && (
        <EmployeePicker
          title={`เลือกผู้อนุมัติ ${picking}`}
          employees={employees}
          exclude={[employee._id, picking === 1 ? norm.approver2Id : norm.approver1Id]}
          onClose={() => setPicking(null)}
          onPick={(p) => {
            setPair((x) => ({ ...x, [picking === 1 ? "a1" : "a2"]: p._id }));
            setPicking(null);
          }}
        />
      )}
    </Dialog>
  );
}
