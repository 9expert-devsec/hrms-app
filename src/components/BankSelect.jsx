'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

export default function BankSelect({
  value = null,
  onChange = () => {},
  banks = [],     // <-- ตั้งค่าเริ่มต้นเป็น array ว่าง
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const list = Array.isArray(banks) ? banks : []; // <-- ป้องกันกรณีไม่ใช่อาร์เรย์
  const selected = useMemo(
    () => list.find((b) => b.code === value) ?? null,
    [list, value]
  );

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // กรณีไม่มีรายการธนาคารเลย ให้แสดงปุ่ม disabled (กันพัง + สื่อสารสถานะ)
  if (!list.length) {
    return (
      <div className="mt-1 relative" ref={ref}>
        <button
          type="button"
          disabled
          className="w-full inline-flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 text-left opacity-60 cursor-not-allowed"
        >
          <span className="text-slate-400">— ไม่มีรายการธนาคาร —</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full inline-flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 hover:bg-white/10 text-left"
      >
        <span className="inline-flex items-center gap-3 text-slate-100">
          {selected ? (
            <>
              <Image
                src={selected.logo}
                alt={selected.name}
                width={22}
                height={22}
                className="rounded"
              />
              {selected.name}
            </>
          ) : (
            <span className="text-slate-400">— เลือกธนาคาร —</span>
          )}
        </span>
        <ChevronDown className="size-4 text-slate-300" />
      </button>

      {open && (
        <ul className="absolute z-20 mt-2 w-full rounded-xl bg-[#0F172A] ring-1 ring-white/10 shadow-lg overflow-hidden">
          {list.map((b) => (
            <li key={b.code}>
              <button
                type="button"
                onClick={() => {
                  onChange(b.code);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-slate-100"
              >
                <Image
                  src={b.logo}
                  alt={b.name}
                  width={20}
                  height={20}
                  className="rounded"
                />
                <span>{b.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
