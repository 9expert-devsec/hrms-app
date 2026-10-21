"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { OFFSITE_STATUSES, STATUS_LABELS, PROGRESS_STEPS, formatWorkDateTh } from "@/lib/offsiteRules";
import { useVersionWatch } from "../useVisibilityPoll";
import { CARD, INPUT_STYLE, NAVY, SLATE, Button, ErrorBox, LiveToast, StatusChip, api } from "./ui";

const TOAST_MS = 3000;

const FILTER_STATUSES = OFFSITE_STATUSES.filter((s) => s !== "draft");

/** ขั้นปัจจุบัน column. */
function currentStep(it) {
  if (it.status === "cancelled") return "—";
  if (it.status === "approved") return "อนุมัติแล้ว";
  return PROGRESS_STEPS[it.progress?.position ?? 0];
}

/** HR-wide list (offsite_hr): filters and paging run on the server. */
export default function OffsiteAllList() {
  const [filters, setFilters] = useState({ status: "", month: "", department: "", q: "" });
  const [query, setQuery] = useState(filters); // applied filters
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(false);
  const toastTimer = useRef(null);

  // `quiet`: a live refresh — the table stays on screen while it reloads; the filter inputs are never touched.
  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setData(null);
        setError("");
      }
      const qs = new URLSearchParams({ ...query, page: String(page) });
      await api(`/api/offsite/all?${qs}`)
        .then(setData)
        .catch((e) => setError(e.message));
    },
    [query, page]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useVersionWatch("/api/offsite/version?scope=all", data?.version || "", async () => {
    await load(true);
    setToast(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), TOAST_MS);
  });

  const apply = (patch = {}) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setQuery(next);
    setPage(1);
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const select = { ...INPUT_STYLE, width: "auto", minWidth: 150 };

  return (
    <div className="space-y-6">
      <LiveToast show={toast} />
      <h1 style={{ color: NAVY, fontSize: "1.5rem", fontWeight: 600 }}>คำขอทำงานนอกสถานที่ทั้งหมด</h1>

      <form
        className="flex flex-wrap items-end gap-3 p-4"
        style={CARD}
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <label className="text-xs" style={{ color: SLATE }}>
          สถานะ
          <select className="mt-1 block" style={select} value={filters.status} onChange={(e) => apply({ status: e.target.value })} aria-label="สถานะ">
            <option value="">ทั้งหมด</option>
            {FILTER_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label className="text-xs" style={{ color: SLATE }}>
          เดือนที่ทำงาน
          <input type="month" className="mt-1 block" style={select} value={filters.month} onChange={(e) => apply({ month: e.target.value })} aria-label="เดือนที่ทำงาน" />
        </label>
        <label className="text-xs" style={{ color: SLATE }}>
          แผนก
          <select className="mt-1 block" style={select} value={filters.department} onChange={(e) => apply({ department: e.target.value })} aria-label="แผนก">
            <option value="">ทุกแผนก</option>
            {(data?.departments || (filters.department ? [filters.department] : [])).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="min-w-[240px] flex-1 text-xs" style={{ color: SLATE }}>
          ค้นหา
          <span className="mt-1 flex items-center gap-2" style={{ ...INPUT_STYLE, padding: "8px 12px" }}>
            <Search size={14} />
            <input
              className="flex-1 outline-none"
              style={{ color: NAVY }}
              placeholder="เลขที่ / ชื่องาน / ชื่อสมาชิก (ไทยหรืออังกฤษ)"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              aria-label="ค้นหา"
            />
          </span>
        </label>
        <Button type="submit">ค้นหา</Button>
      </form>

      <ErrorBox>{error}</ErrorBox>

      <div className="overflow-x-auto p-2" style={CARD}>
        <table className="w-full text-sm" data-testid="offsite-all-table">
          <thead>
            <tr className="text-left text-xs" style={{ color: SLATE }}>
              <th className="px-3 py-2">เลขที่</th>
              <th className="px-3 py-2">ชื่องาน</th>
              <th className="px-3 py-2">วันที่ทำงาน</th>
              <th className="px-3 py-2">ผู้สร้าง</th>
              <th className="px-3 py-2">แผนก</th>
              <th className="px-3 py-2 text-right">จำนวนคน</th>
              <th className="px-3 py-2">สถานะ</th>
              <th className="px-3 py-2">ขั้นปัจจุบัน</th>
            </tr>
          </thead>
          <tbody>
            {!data && !error && (
              <tr>
                <td colSpan={8} className="px-3 py-6">
                  <Loader2 className="animate-spin" size={18} />
                </td>
              </tr>
            )}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center" style={{ color: SLATE }}>ไม่พบคำขอตามเงื่อนไข</td>
              </tr>
            )}
            {(data?.items || []).map((it) => (
              <tr key={it._id} className="border-t" style={{ borderColor: "#EEF2F7", color: NAVY }}>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={`/dashboard/offsite/${it._id}`} className="underline" style={{ color: "#005CFF" }}>
                    {it.docNo || "ยังไม่ออกเลข"}
                  </Link>
                </td>
                <td className="px-3 py-2">{it.jobName}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatWorkDateTh(it.workDate)}</td>
                <td className="px-3 py-2">{it.creatorNameTh}</td>
                <td className="px-3 py-2">{it.creatorDepartment}</td>
                <td className="px-3 py-2 text-right">{it.memberCount}</td>
                <td className="px-3 py-2"><StatusChip status={it.status} /></td>
                <td className="px-3 py-2 text-xs" style={{ color: SLATE }}>{currentStep(it)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm" style={{ color: SLATE }}>
          <span>ทั้งหมด {data.total} รายการ</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="หน้าก่อน">
              <ChevronLeft size={14} />
            </Button>
            <span>หน้า {page} / {pages}</span>
            <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="หน้าถัดไป">
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
