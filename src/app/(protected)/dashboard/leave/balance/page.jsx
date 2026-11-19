"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { BLUE, LINE, MUTED, NAVY, PAGE, PAGE_BG, SLATE } from "../../../../../components/hr/hrUi";
import { STATUS_CHIPS } from "@/lib/leave/flow";
import { formatLeaveAmount, leavePeriodText } from "@/lib/leave/format";
import { fiscalYearLabel } from "@/lib/leaveRules";

const CARD = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 18 };

/**
 * วันลาคงเหลือ (round 42): per fiscal year, one card per active leave type on
 * the round-39 quotas and the round-40 usage (GET /api/leave/balance), then
 * that year's leaves, each linking to its document.
 */
export default function LeaveBalancePage() {
  const [fy, setFy] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (year) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/leave/balance${year ? `?fy=${year}` : ""}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || j.ok === false) throw new Error(j.message || "โหลดข้อมูลไม่สำเร็จ");
      setData(j);
      setFy(j.fiscalYear);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(null);
  }, [load]);

  const amt = (h) => formatLeaveAmount(h, { hoursPerDay: data?.hoursPerDay });

  return (
    <div className={PAGE} style={PAGE_BG}>
      <div className="mx-auto max-w-[1100px]" data-testid="balance-page">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-bold" style={{ color: NAVY }}>วันลาคงเหลือ</h1>
            <p className="text-[13px]" style={{ color: SLATE }}>ตามสิทธิ์วันลาที่ฝ่ายบุคคลกำหนด · ใช้ = อนุมัติแล้ว · รออนุมัติ = ใบลาที่ยังไม่อนุมัติ</p>
          </div>
          {data && (
            <label className="flex items-center gap-2 text-[14px]" style={{ color: SLATE }}>
              ปีงบประมาณ
              <select
                value={fy ?? ""}
                onChange={(e) => load(Number(e.target.value))}
                className="h-11 rounded-xl border bg-white px-3 text-[14px] outline-none focus:ring-2 focus:ring-[#005CFF]/30"
                style={{ borderColor: LINE, color: NAVY }}
                data-testid="balance-fy"
              >
                {data.fiscalYears.map((y) => (
                  <option key={y} value={y}>
                    {fiscalYearLabel(y)}
                    {y === data.currentFiscalYear ? " (ปีนี้)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {loading && !data ? (
          <div className="mt-6 flex items-center gap-2 text-[14px]" style={{ color: SLATE }}>
            <Loader2 size={16} className="animate-spin" /> กำลังโหลด…
          </div>
        ) : error ? (
          <p className="mt-6 p-5 text-[14px]" style={{ ...CARD, color: "#B91C1C" }}>{error}</p>
        ) : data ? (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" style={{ opacity: loading ? 0.6 : 1 }}>
              {data.types.map((t) => {
                const limited = t.quotaHours !== null;
                const pct = limited && t.quotaHours > 0 ? Math.min(100, ((t.usedHours + t.pendingHours) / t.quotaHours) * 100) : 0;
                const usedPct = limited && t.quotaHours > 0 ? Math.min(100, (t.usedHours / t.quotaHours) * 100) : 0;
                return (
                  <section key={t._id} className="p-5" style={CARD} data-testid="balance-card" data-type={t.nameTh}>
                    <h2 className="text-[16px] font-bold" style={{ color: NAVY }}>{t.nameTh}</h2>
                    {limited ? (
                      <>
                        <p className="mt-3 text-[28px] font-bold leading-none" style={{ color: t.remainingHours < 0 ? "#B91C1C" : BLUE }} data-testid="balance-remaining">
                          คงเหลือ {amt(t.remainingHours)}
                        </p>
                        <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: "#EEF2F7" }} aria-hidden>
                          <div className="relative h-full" style={{ width: `${pct}%`, background: "#BFD4FF" }}>
                            <div className="h-full" style={{ width: pct ? `${(usedPct / pct) * 100}%` : 0, background: BLUE }} />
                          </div>
                        </div>
                        <p className="mt-2 text-[13px]" style={{ color: SLATE }} data-testid="balance-used">ใช้ {amt(t.usedHours)} / {amt(t.quotaHours)}</p>
                        {t.pendingHours > 0 && <p className="text-[13px]" style={{ color: MUTED }} data-testid="balance-pending">รออนุมัติ {amt(t.pendingHours)}</p>}
                      </>
                    ) : (
                      <p className="mt-3 text-[15px] font-semibold" style={{ color: SLATE }} data-testid="balance-unlimited">
                        ไม่จำกัด · ใช้ไป {amt(t.usedHours)}
                        {t.pendingHours > 0 && <span className="block text-[13px] font-normal" style={{ color: MUTED }}>รออนุมัติ {amt(t.pendingHours)}</span>}
                      </p>
                    )}
                  </section>
                );
              })}
            </div>

            <section className="mt-6" style={CARD}>
              <h2 className="px-5 pt-5 text-[16px] font-bold" style={{ color: NAVY }}>ใบลาในปีงบ {fiscalYearLabel(data.fiscalYear)}</h2>
              {data.leaves.length === 0 ? (
                <p className="p-5 text-[14px]" style={{ color: SLATE }}>ยังไม่มีใบลาในปีงบนี้</p>
              ) : (
                <ul className="mt-2" data-testid="balance-leaves">
                  {data.leaves.map((l) => {
                    const c = STATUS_CHIPS[l.status] || { label: l.status, bg: "#EEF2F7", color: "#475569" };
                    return (
                      <li key={l._id} style={{ borderTop: `1px solid ${LINE}` }}>
                        <Link href={`/dashboard/leave/document?id=${l._id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-[#F8FAFD]">
                          <span className="min-w-[96px] text-[14px] font-semibold" style={{ color: NAVY }}>{l.leaveTypeName}</span>
                          <span className="text-[14px]" style={{ color: SLATE }}>{leavePeriodText(l)}</span>
                          <span className="text-[14px]" style={{ color: SLATE }}>· {formatLeaveAmount(l.totalHours, { unit: l.unit, hoursPerDay: data.hoursPerDay })}</span>
                          <span className="ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: c.bg, color: c.color }}>{c.label}</span>
                          <ChevronRight size={16} style={{ color: MUTED }} aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
