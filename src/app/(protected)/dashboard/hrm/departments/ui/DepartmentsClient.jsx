"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, ListOrdered, Loader2, Pencil, Search, Users } from "lucide-react";
import { BLUE, BTN_PRIMARY, BTN_SECONDARY, CodeChip, FOCUS, INPUT, LINE, MUTED, NAVY, SLATE } from "../../../../../../components/hr/hrUi";

const LEAVE_PROMPT = "ยังไม่ได้บันทึกลำดับแผนก — ออกจากหน้านี้โดยไม่บันทึกหรือไม่?";

/** แผนกและตำแหน่ง cards + search (name, code, description); "จัดลำดับ" for editors. */
export default function DepartmentsClient({ items, canEdit = false }) {
  const [q, setQ] = useState("");
  const [ordering, setOrdering] = useState(false);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((d) => [d.name, d.code, d.description].some((v) => (v || "").toLowerCase().includes(s)));
  }, [q, items]);

  if (ordering) return <OrderEditor items={items} onDone={() => setOrdering(false)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">ค้นหาแผนก</span>
          <Search size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อแผนก รหัส หรือคำอธิบาย"
            className={`${INPUT} pl-10`}
            data-testid="dept-search"
          />
        </label>
        {canEdit && items.length > 1 && (
          <button type="button" onClick={() => setOrdering(true)} className={`${BTN_SECONDARY} shrink-0`} data-testid="dept-order">
            <ListOrdered size={16} aria-hidden /> จัดลำดับ
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-[14px]" style={{ border: `1px solid ${LINE}`, color: SLATE }} data-testid="dept-empty">
          ไม่พบแผนกที่ตรงกับการค้นหา
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => (
            <li
              key={d._id}
              className="flex flex-col gap-3.5 rounded-[18px] bg-white px-5 py-5"
              style={{ border: `1px solid ${LINE}` }}
              data-testid="dept-card"
              data-code={d.code}
            >
              <div className="flex items-center gap-2.5">
                <CodeChip code={d.code} color={d.color} />
                <h2 className="min-w-0 flex-1 break-words text-[16px] font-semibold" style={{ color: NAVY }} data-testid="dept-name">{d.name}</h2>
                {canEdit && (
                  <Link
                    href={`/dashboard/hrm/departments/${d._id}/edit`}
                    aria-label={`แก้ไขแผนก ${d.name}`}
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] md:h-9 md:w-9 ${FOCUS}`}
                    style={{ background: "#F5F8FF", color: BLUE }}
                    data-testid="dept-edit"
                  >
                    <Pencil size={16} aria-hidden />
                  </Link>
                )}
              </div>

              {d.description && <p className="text-[13px]" style={{ color: SLATE }} data-testid="dept-desc">{d.description}</p>}

              <div className="rounded-xl px-3 py-2.5" style={{ background: "#FFFBEA" }} data-testid="dept-head">
                {d.headName ? (
                  <p className="text-[13px]">
                    <span style={{ color: SLATE }}>หัวหน้าแผนก</span>{" "}
                    <span className="font-semibold" style={{ color: NAVY }} data-testid="dept-head-name">{d.headName}</span>
                  </p>
                ) : (
                  <p className="text-[13px] font-medium" style={{ color: "#92400E" }}>ยังไม่ได้กำหนดหัวหน้าแผนก</p>
                )}
              </div>

              <p className="flex items-center gap-1.5 text-[13px]" style={{ color: NAVY }} data-testid="dept-count">
                <Users size={15} aria-hidden style={{ color: SLATE }} /> พนักงาน {d.empCount} คน
              </p>

              <div>
                <p className="text-[12px] font-semibold" style={{ color: SLATE }}>ตำแหน่ง {d.positions.length}</p>
                {d.positions.length === 0 ? (
                  <p className="mt-1.5 text-[13px]" style={{ color: SLATE }} data-testid="dept-no-positions">ยังไม่มีตำแหน่ง</p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid="dept-positions">
                    {d.positions.map((p, i) => (
                      <span key={`${p}-${i}`} className="rounded-full bg-white px-2.5 py-0.5 text-[12px]" style={{ border: "1px solid #D6E0F0", color: NAVY }}>
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * "จัดลำดับ": one compact row per department — drag handle, code chip, name,
 * เลื่อนขึ้น / เลื่อนลง. Changes stay here until บันทึกลำดับ (one request for
 * every department); ยกเลิก discards; leaving with changes asks first.
 */
function OrderEditor({ items, onDone }) {
  const router = useRouter();
  const [list, setList] = useState(items);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");
  const [dragId, setDragId] = useState(null);
  const listRef = useRef(null);
  const focusAfter = useRef(null); // { id, dir } — keep focus on the moved row's button

  const dirty = list.some((d, i) => d._id !== items[i]?._id);

  const say = (d, index) => setAnnounce(`ย้าย ${d.name} ไปลำดับที่ ${index + 1}`);
  function move(from, to) {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [d] = next.splice(from, 1);
    next.splice(to, 0, d);
    setList(next);
    return d;
  }
  function step(index, delta) {
    const d = move(index, index + delta);
    if (!d) return;
    focusAfter.current = { id: d._id, dir: delta < 0 ? "up" : "down" };
    say(d, index + delta);
  }

  useEffect(() => {
    const f = focusAfter.current;
    if (!f) return;
    focusAfter.current = null;
    const row = listRef.current?.querySelector(`[data-row="${f.id}"]`);
    const btn = row?.querySelector(`[data-move="${f.dir}"]`);
    (btn && !btn.disabled ? btn : row?.querySelector(`[data-move="${f.dir === "up" ? "down" : "up"}"]`))?.focus();
  }, [list]);

  // Unsaved changes: the browser asks on reload / close; links in the app ask here.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a || e.defaultPrevented) return;
      if (!window.confirm(LEAVE_PROMPT)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  // Drag by the handle (mouse, pen or touch): the row follows the pointer.
  function onHandleDown(e, id) {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragId(id);
  }
  function onHandleMove(e) {
    if (!dragId) return;
    const rows = [...(listRef.current?.querySelectorAll("[data-row]") || [])];
    const from = list.findIndex((d) => d._id === dragId);
    let to = rows.findIndex((r) => {
      const b = r.getBoundingClientRect();
      return e.clientY < b.top + b.height / 2;
    });
    if (to < 0) to = rows.length - 1;
    else if (to > from) to -= 1;
    if (to !== from) move(from, to);
  }
  function onHandleUp() {
    if (!dragId) return;
    const index = list.findIndex((d) => d._id === dragId);
    if (index >= 0 && list[index]._id !== items[index]?._id) say(list[index], index);
    setDragId(null);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/departments/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: list.map((d) => d._id) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.message || "บันทึกลำดับไม่สำเร็จ");
      router.refresh();
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="dept-order-editor">
      <p className="text-[14px]" style={{ color: SLATE }}>
        ลากที่จับ หรือใช้ปุ่มเลื่อนขึ้น / เลื่อนลง — ลำดับนี้ใช้ทุกหน้าที่แสดงแผนก
      </p>
      <ol ref={listRef} className="overflow-hidden rounded-2xl bg-white" style={{ border: `1px solid ${LINE}` }} data-testid="dept-order-list">
        {list.map((d, i) => (
          <li
            key={d._id}
            data-row={d._id}
            className="flex items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-3"
            style={{ borderTop: i ? "1px solid #EEF2F8" : "none", background: dragId === d._id ? "#F5F8FF" : "#FFFFFF" }}
            data-testid="dept-order-row"
            data-code={d.code}
          >
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              onPointerDown={(e) => onHandleDown(e, d._id)}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
              className="grid h-11 w-9 shrink-0 cursor-grab place-items-center rounded-lg active:cursor-grabbing"
              style={{ color: MUTED, touchAction: "none" }}
              data-testid="dept-order-handle"
            >
              <GripVertical size={18} />
            </button>
            <span className="w-6 shrink-0 text-right text-[13px] font-semibold tabular-nums" style={{ color: SLATE }} aria-hidden>{i + 1}</span>
            <CodeChip code={d.code} color={d.color} />
            <span id={`dept-order-name-${d._id}`} className="min-w-0 flex-1 truncate text-[15px] font-medium" style={{ color: NAVY }}>{d.name}</span>
            <button
              type="button"
              onClick={() => step(i, -1)}
              disabled={i === 0 || saving}
              aria-label="เลื่อนขึ้น"
              aria-describedby={`dept-order-name-${d._id}`}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] disabled:opacity-30 ${FOCUS}`}
              style={{ background: "#F5F8FF", color: BLUE }}
              data-move="up"
              data-testid="dept-order-up"
            >
              <ArrowUp size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => step(i, 1)}
              disabled={i === list.length - 1 || saving}
              aria-label="เลื่อนลง"
              aria-describedby={`dept-order-name-${d._id}`}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] disabled:opacity-30 ${FOCUS}`}
              style={{ background: "#F5F8FF", color: BLUE }}
              data-move="down"
              data-testid="dept-order-down"
            >
              <ArrowDown size={18} aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite" data-testid="dept-order-live">{announce}</p>

      <div
        className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 rounded-2xl bg-white/95 px-3 py-3 backdrop-blur"
        style={{ border: `1px solid ${LINE}`, boxShadow: "0 -4px 16px rgba(13,27,42,0.06)" }}
        data-testid="dept-order-bar"
      >
        {error && <p role="alert" className="mr-auto text-[13px] font-medium" style={{ color: "#B91C1C" }}>{error}</p>}
        {!error && dirty && <p className="mr-auto text-[13px]" style={{ color: SLATE }}>มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</p>}
        <button type="button" onClick={onDone} disabled={saving} className={BTN_SECONDARY} data-testid="dept-order-cancel">
          ยกเลิก
        </button>
        <button type="button" onClick={save} disabled={!dirty || saving} className={BTN_PRIMARY} data-testid="dept-order-save">
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden />} บันทึกลำดับ
        </button>
      </div>
    </div>
  );
}
