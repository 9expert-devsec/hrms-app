"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Search, Send, Save, Trash2, Crown, UserPlus } from "lucide-react";
import { Req, FieldError, ErrorSummary } from "../FormValidation";
import { employeeDisplayName, employeeNameEn, employeeNameSearchText } from "@/lib/employeeName";
import {
  MAX_MEMBERS,
  OFFSITE_FIELD_LABELS,
  TRAVEL_MODES,
  TRAVEL_MODE_LABELS,
  validateOffsiteInput,
  workDateInput,
} from "@/lib/offsiteRules";
import { CARD, INPUT_STYLE, INPUT_ERROR, NAVY, SLATE, BLUE, Button, ErrorBox, api } from "./ui";

const P = "os"; // FieldError id prefix

function emptyForm(creatorId) {
  return {
    jobName: "",
    workDate: "",
    startTime: "09:00",
    endTime: "17:00",
    description: "",
    placeName: "",
    address: "",
    travelMode: "",
    note: "",
    members: creatorId ? [{ employee: creatorId, duty: "" }] : [],
    leader: creatorId || "",
  };
}

function fromRequest(r) {
  return {
    jobName: r.jobName || "",
    workDate: workDateInput(r.workDate),
    startTime: r.startTime || "",
    endTime: r.endTime || "",
    description: r.description || "",
    placeName: r.placeName || "",
    address: r.address || "",
    travelMode: r.travelMode || "",
    note: r.note || "",
    members: (r.members || []).map((m) => ({ employee: m.employee, duty: m.duty || "", status: m.status })),
    leader: r.leader || "",
  };
}

/** Edit page: load the request, then the form (creator only; draft or returned). */
export function OffsiteEditLoader({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api(`/api/offsite/requests/${id}`)
      .then((j) => {
        if (!j.viewer.canEdit) setError("แก้ไขคำขอนี้ไม่ได้ (เฉพาะผู้สร้าง เมื่อเป็นฉบับร่างหรือถูกส่งกลับ)");
        else setData(j);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loader2 className="animate-spin" size={18} />;
  return <OffsiteForm request={data.request} />;
}

function Field({ k, label, required, errors, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium" style={{ color: NAVY }}>
        {label}
        {required && <Req />}
      </span>
      {children}
      <FieldError k={k} errors={errors} prefix={P} />
    </label>
  );
}

/**
 * Create (`request` null) or edit an off-site request. "บันทึกฉบับร่าง"
 * saves; "ส่งคำเชิญ" saves then sends invitations. Both go to the request
 * page afterwards.
 */
export default function OffsiteForm({ request = null }) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const creatorId = request ? request.createdBy : session?.user?.employeeId || null;

  const [form, setForm] = useState(() => (request ? fromRequest(request) : emptyForm(null)));
  const [employees, setEmployees] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [q, setQ] = useState("");
  const [errors, setErrors] = useState({});
  const [memberErrors, setMemberErrors] = useState({});
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(null); // "draft" | "send"

  // New request: the creator is the first member and the default leader.
  useEffect(() => {
    if (!request && creatorId && !form.members.length) setForm(emptyForm(creatorId));
  }, [request, creatorId, form.members.length]);

  useEffect(() => {
    api("/api/offsite/employees")
      .then((j) => setEmployees(j.items || []))
      .catch((e) => setLoadError(e.message));
  }, []);

  const byId = useMemo(() => new Map(employees.map((e) => [e._id, e])), [employees]);
  const chosen = new Set(form.members.map((m) => m.employee));

  const results = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return [];
    return employees
      .filter((e) => !chosen.has(e._id))
      .filter((e) => `${employeeNameSearchText(e)} ${e.empAutoId || ""}`.includes(kw))
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, employees, form.members]);

  const revalidate = (next) => {
    if (!tried) return;
    const v = validateOffsiteInput(next, { creatorId });
    setErrors(v.errors);
    setMemberErrors(v.memberErrors);
  };
  const set = (patch) => {
    const next = { ...form, ...patch };
    setForm(next);
    revalidate(next);
  };
  const setMember = (i, patch) => set({ members: form.members.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const addMember = (id) => {
    if (form.members.length >= MAX_MEMBERS) return;
    set({ members: [...form.members, { employee: id, duty: "" }] });
    setQ("");
  };
  const removeMember = (i) => {
    const gone = form.members[i]?.employee;
    set({ members: form.members.filter((_, j) => j !== i), leader: form.leader === gone ? "" : form.leader });
  };

  const nameOf = (id) => {
    const e = byId.get(id);
    if (e) return employeeDisplayName(e);
    return request?.members?.find((m) => m.employee === id)?.nameSnapshot || "…";
  };

  const payload = () => ({
    ...form,
    members: form.members.map(({ employee, duty }) => ({ employee, duty })),
  });

  const submit = async (mode) => {
    setTried(true);
    setServerError("");
    const v = validateOffsiteInput(form, { creatorId });
    setErrors(v.errors);
    setMemberErrors(v.memberErrors);
    if (Object.keys(v.errors).length) return;

    setBusy(mode);
    try {
      const saved = request
        ? await api(`/api/offsite/requests/${request._id}`, { method: "PATCH", body: payload() })
        : await api("/api/offsite/requests", { method: "POST", body: payload() });
      const id = saved.request._id;
      if (mode === "send") {
        try {
          await api(`/api/offsite/requests/${id}`, { method: "POST", body: { action: "send" } });
        } catch (e) {
          // Saved as a draft; show the reason on the request page.
          router.push(`/dashboard/offsite/${id}?error=${encodeURIComponent(e.message)}`);
          return;
        }
      }
      router.push(`/dashboard/offsite/${id}`);
      router.refresh();
    } catch (e) {
      if (e.body?.errors) {
        setErrors(e.body.errors);
        setMemberErrors(e.body.memberErrors || {});
      }
      setServerError(e.message);
      setBusy(null);
    }
  };

  if (!request && sessionStatus === "loading") {
    return <Loader2 className="animate-spin" size={18} />;
  }
  if (!request && !creatorId) {
    return <ErrorBox>บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน จึงสร้างคำขอไม่ได้</ErrorBox>;
  }

  const errorKeys = tried ? Object.keys(errors) : [];
  const inputStyle = (k) => (errors[k] ? INPUT_ERROR : INPUT_STYLE);
  const aria = (k, required = true) => ({
    "aria-required": required || undefined,
    "aria-invalid": !!errors[k] || undefined,
    "aria-describedby": errors[k] ? `${P}-${k}-error` : undefined,
  });

  return (
    <div className="space-y-6">
      {/* ── Job details ───────────────────────────── */}
      <section className="space-y-4 p-6" style={CARD}>
        <h2 style={{ color: NAVY, fontWeight: 600 }}>รายละเอียดงาน</h2>
        <Field k="jobName" label={OFFSITE_FIELD_LABELS.jobName} required errors={errors}>
          <input style={inputStyle("jobName")} value={form.jobName} onChange={(e) => set({ jobName: e.target.value })} {...aria("jobName")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field k="workDate" label={OFFSITE_FIELD_LABELS.workDate} required errors={errors}>
            <input type="date" style={inputStyle("workDate")} value={form.workDate} onChange={(e) => set({ workDate: e.target.value })} {...aria("workDate")} />
          </Field>
          <Field k="startTime" label={OFFSITE_FIELD_LABELS.startTime} required errors={errors}>
            <input type="time" style={inputStyle("startTime")} value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} {...aria("startTime")} />
          </Field>
          <Field k="endTime" label={OFFSITE_FIELD_LABELS.endTime} required errors={errors}>
            <input type="time" style={inputStyle("endTime")} value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} {...aria("endTime")} />
          </Field>
        </div>
        <Field k="description" label={OFFSITE_FIELD_LABELS.description} required errors={errors}>
          <textarea rows={3} style={inputStyle("description")} value={form.description} onChange={(e) => set({ description: e.target.value })} {...aria("description")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field k="placeName" label={OFFSITE_FIELD_LABELS.placeName} required errors={errors}>
            <input style={inputStyle("placeName")} value={form.placeName} onChange={(e) => set({ placeName: e.target.value })} {...aria("placeName")} />
          </Field>
          <Field k="address" label={OFFSITE_FIELD_LABELS.address} required errors={errors}>
            <input style={inputStyle("address")} value={form.address} onChange={(e) => set({ address: e.target.value })} {...aria("address")} />
          </Field>
        </div>
        <fieldset aria-describedby={errors.travelMode ? `${P}-travelMode-error` : undefined}>
          <legend className="mb-1 text-sm font-medium" style={{ color: NAVY }}>
            {OFFSITE_FIELD_LABELS.travelMode}
            <Req />
          </legend>
          <div className="flex flex-wrap gap-4">
            {TRAVEL_MODES.map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm" style={{ color: NAVY }}>
                <input type="radio" name="travelMode" checked={form.travelMode === mode} onChange={() => set({ travelMode: mode })} />
                {TRAVEL_MODE_LABELS[mode]}
              </label>
            ))}
          </div>
          <FieldError k="travelMode" errors={errors} prefix={P} />
        </fieldset>
        <Field k="note" label={OFFSITE_FIELD_LABELS.note} errors={errors}>
          <textarea rows={2} style={inputStyle("note")} value={form.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>
      </section>

      {/* ── Members ───────────────────────────────── */}
      <section className="space-y-4 p-6" style={CARD}>
        <div className="flex items-center justify-between">
          <h2 style={{ color: NAVY, fontWeight: 600 }}>
            สมาชิกที่ไปปฏิบัติงาน<Req />
          </h2>
          <span className="text-xs" style={{ color: SLATE }}>
            {form.members.length}/{MAX_MEMBERS} คน
          </span>
        </div>
        <FieldError k="members" errors={errors} prefix={P} />
        <ErrorBox>{loadError}</ErrorBox>

        <ul className="space-y-2">
          {form.members.map((m, i) => {
            const isCreator = m.employee === creatorId;
            const e = byId.get(m.employee);
            return (
              <li key={m.employee} className="flex flex-wrap items-start gap-3 rounded-xl p-3" style={{ background: "#F8FAFD" }}>
                <div className="min-w-[180px] flex-1">
                  <div className="text-sm font-medium" style={{ color: NAVY }}>
                    {i + 1}. {nameOf(m.employee)}
                    {isCreator && <span className="ml-2 text-xs" style={{ color: BLUE }}>(ผู้สร้างคำขอ)</span>}
                    {form.leader === m.employee && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs" style={{ color: "#B45309" }}>
                        <Crown size={12} /> หัวหน้าทีม
                      </span>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: SLATE }}>
                    {[e && employeeNameEn(e) !== employeeDisplayName(e) ? employeeNameEn(e) : null, e?.position, e?.department].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="min-w-[220px] flex-[2]">
                  <input
                    style={memberErrors[i] ? INPUT_ERROR : INPUT_STYLE}
                    placeholder="หน้าที่ในงานนี้ *"
                    value={m.duty}
                    onChange={(ev) => setMember(i, { duty: ev.target.value })}
                    aria-label={`หน้าที่ของ ${nameOf(m.employee)}`}
                    aria-required
                    aria-invalid={!!memberErrors[i] || undefined}
                  />
                  {memberErrors[i] && <p className="mt-1 text-xs text-red-500">{memberErrors[i]}</p>}
                </div>
                {!isCreator && (
                  <button type="button" onClick={() => removeMember(i)} title="นำออก" className="mt-2" style={{ color: "#DC2626" }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {form.members.length < MAX_MEMBERS && (
          <div className="relative">
            <div className="flex items-center gap-2" style={{ ...INPUT_STYLE, padding: "8px 12px" }}>
              <Search size={14} style={{ color: SLATE }} />
              <input
                className="flex-1 outline-none"
                placeholder="ค้นหาพนักงานเพื่อเพิ่มเป็นสมาชิก (ชื่อไทย / อังกฤษ / ชื่อเล่น)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="ค้นหาพนักงาน"
              />
            </div>
            {results.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl bg-white" style={{ border: "1px solid rgba(0,92,255,0.15)", boxShadow: "0 8px 24px rgba(13,27,42,0.12)" }}>
                {results.map((e) => (
                  <li key={e._id}>
                    <button type="button" onClick={() => addMember(e._id)} className="touch-44 flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
                      <UserPlus size={14} style={{ color: BLUE }} />
                      <span style={{ color: NAVY }}>{employeeDisplayName(e)}</span>
                      <span className="text-xs" style={{ color: SLATE }}>
                        {[employeeNameEn(e) !== employeeDisplayName(e) ? employeeNameEn(e) : null, e.nickName, e.position].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Field k="leader" label={OFFSITE_FIELD_LABELS.leader} required errors={errors}>
          <select style={inputStyle("leader")} value={form.leader} onChange={(e) => set({ leader: e.target.value })} {...aria("leader")}>
            <option value="">— เลือกหัวหน้าทีมจากสมาชิก —</option>
            {form.members.map((m) => (
              <option key={m.employee} value={m.employee}>
                {nameOf(m.employee)}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <ErrorSummary errorKeys={errorKeys} serverError={serverError ? { message: serverError } : null} labels={OFFSITE_FIELD_LABELS} />

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={() => submit("draft")} disabled={!!busy}>
          {busy === "draft" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} บันทึกฉบับร่าง
        </Button>
        <Button onClick={() => submit("send")} disabled={!!busy}>
          {busy === "send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {request && request.status === "returned" ? "บันทึกและส่งคำเชิญอีกครั้ง" : "ส่งคำเชิญ"}
        </Button>
      </div>
    </div>
  );
}
