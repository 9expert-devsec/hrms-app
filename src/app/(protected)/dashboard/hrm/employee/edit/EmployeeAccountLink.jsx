"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus, Link2 } from "lucide-react";
import RoleSelect from "./../../../../../../components/RoleSelect";
import TempPasswordDialog from "./../../../../../../components/TempPasswordDialog";

/**
 * บัญชีผู้ใช้ panel for an employee with NO account (employees holders and
 * the superadmin): create one (temporary password, shown once) or link an
 * existing account that no employee uses. API: /api/employees/[id]/account.
 * The page reloads afterwards so the linked-account panel takes over.
 */
export default function EmployeeAccountLink({ employeeId, employeeEmail, isSuperadmin }) {
  const [email, setEmail] = useState(employeeEmail || "");
  const [role, setRole] = useState("employee");
  const [candidates, setCandidates] = useState(null); // null = loading
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(null); // "create" | "link"
  const [tempResult, setTempResult] = useState(null); // { email, tempPassword }, shown once

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/employees/${employeeId}/account`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (alive) setCandidates(r.ok ? j.candidates || [] : []);
      } catch {
        if (alive) setCandidates([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [employeeId]);

  async function create() {
    setBusy("create");
    try {
      const r = await fetch(`/api/employees/${employeeId}/account`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isSuperadmin ? { email, role } : { email }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.message || j.error || "สร้างบัญชีไม่สำเร็จ");
      setTempResult({ email: j.account.email, tempPassword: j.tempPassword });
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function link() {
    if (!pick) return;
    const chosen = candidates.find((c) => c._id === pick);
    if (!confirm(`ผูกพนักงานคนนี้กับบัญชี ${chosen?.email} ?`)) return;
    setBusy("link");
    try {
      const r = await fetch(`/api/employees/${employeeId}/account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: pick }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.message || j.error || "ผูกบัญชีไม่สำเร็จ");
      if (j.account?.emailMismatch) alert("ผูกบัญชีแล้ว — หมายเหตุ: อีเมลของบัญชีไม่ตรงกับอีเมลพนักงาน");
      location.reload();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: "#5E6A7E" }}>
        ยังไม่ผูกบัญชีกับพนักงานคนนี้
      </p>

      <div>
        <h4 className="font-medium text-slate-100 mb-1">สร้างบัญชี</h4>
        <p className="text-xs mb-2" style={{ color: "#5E6A7E" }}>
          ระบบจะสร้างรหัสผ่านชั่วคราว (แสดงครั้งเดียว) — พนักงานต้องตั้งรหัสใหม่เมื่อเข้าสู่ระบบครั้งแรก
        </p>
        <label className="text-sm" style={{ color: "#5E6A7E" }}>อีเมล (ล็อกอิน)</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl px-4 py-2.5"
          style={{ background: "#FFFFFF", color: "#0D1B2A", border: "1px solid #E2E8F0" }}
        />
        {/* Only a superadmin picks a role; everyone else creates "employee". */}
        {isSuperadmin ? (
          <div className="mt-3">
            <label className="text-sm" style={{ color: "#5E6A7E" }}>สิทธิ์ (Role)</label>
            <RoleSelect className="select-dark appearance-none mt-1 w-full" value={role} onChange={setRole} />
          </div>
        ) : (
          <p className="text-xs mt-2" style={{ color: "#5E6A7E" }}>สิทธิ์เริ่มต้นคือ <b>employee</b></p>
        )}
        <button
          onClick={create}
          disabled={!!busy || !email}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 px-4 py-2.5 text-white ring-1 ring-white/10 disabled:opacity-60"
        >
          {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <UserPlus size={16} />}
          สร้างบัญชี
        </button>
      </div>

      <hr className="border-white/10" />

      <div>
        <h4 className="font-medium text-slate-100 mb-1">ผูกกับบัญชีที่มีอยู่</h4>
        <p className="text-xs mb-2" style={{ color: "#5E6A7E" }}>
          เลือกได้เฉพาะบัญชีที่ยังไม่ได้ผูกกับพนักงานคนใด
        </p>
        {candidates === null ? (
          <p className="text-xs" style={{ color: "#5E6A7E" }}>กำลังโหลด…</p>
        ) : candidates.length === 0 ? (
          <p className="text-xs" style={{ color: "#5E6A7E" }}>ไม่มีบัญชีที่ยังไม่ได้ผูก</p>
        ) : (
          <>
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5"
              style={{ background: "#FFFFFF", color: "#0D1B2A", border: "1px solid #E2E8F0" }}
              aria-label="บัญชีที่ยังไม่ได้ผูก"
            >
              <option value="">— เลือกบัญชี —</option>
              {candidates.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.email} ({c.role}{c.status === "suspended" ? ", ระงับ" : ""})
                </option>
              ))}
            </select>
            <button
              onClick={link}
              disabled={!!busy || !pick}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 text-slate-200 ring-1 ring-white/10 disabled:opacity-60"
            >
              {busy === "link" ? <Loader2 className="size-4 animate-spin" /> : <Link2 size={16} />}
              ผูกกับบัญชีนี้
            </button>
          </>
        )}
      </div>

      {tempResult && (
        <TempPasswordDialog
          email={tempResult.email}
          tempPassword={tempResult.tempPassword}
          onClose={() => {
            setTempResult(null);
            location.reload();
          }}
        />
      )}
    </div>
  );
}
