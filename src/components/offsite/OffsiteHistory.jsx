"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Loader2 } from "lucide-react";
import { formatWorkDateTh } from "@/lib/offsiteRules";
import { INPUT_STYLE, NAVY, SLATE, ErrorBox, api } from "./ui";

/**
 * Approved off-site work of one employee, by year. Without `employeeId`:
 * my own (ประวัติของฉัน). With it: that employee's (HR view; the API
 * requires offsite_hr).
 */
export default function OffsiteHistory({ employeeId = null }) {
  const [year, setYear] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    const qs = new URLSearchParams();
    if (year) qs.set("year", year);
    if (employeeId) qs.set("employee", employeeId);
    api(`/api/offsite/history?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [year, employeeId]);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loader2 className="animate-spin" size={18} />;

  return (
    <div className="space-y-3" data-testid="offsite-history">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm" style={{ color: SLATE }}>
          ปี พ.ศ.
          <select style={{ ...INPUT_STYLE, width: "auto", padding: "6px 10px" }} value={String(data.year)} onChange={(e) => setYear(e.target.value)} aria-label="ปี">
            {data.years.map((y) => (
              <option key={y} value={y}>{y + 543}</option>
            ))}
          </select>
        </label>
        <span className="text-sm font-semibold" style={{ color: NAVY }}>
          ปี {data.year + 543}: {data.items.length} ครั้ง
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: SLATE }}>
              <th className="py-2 pr-3">วันที่ทำงาน</th>
              <th className="py-2 pr-3">เวลา</th>
              <th className="py-2 pr-3">ชื่องาน</th>
              <th className="py-2 pr-3">สถานที่</th>
              <th className="py-2 pr-3">หน้าที่</th>
              <th className="py-2">เลขที่เอกสาร</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center" style={{ color: SLATE }}>ไม่มีประวัติทำงานนอกสถานที่ที่อนุมัติแล้วในปีนี้</td>
              </tr>
            )}
            {data.items.map((it) => (
              <tr key={it._id} className="border-t align-top" style={{ borderColor: "#EEF2F7", color: NAVY }}>
                <td className="py-2 pr-3 whitespace-nowrap">{formatWorkDateTh(it.workDate)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{it.startTime}–{it.endTime}</td>
                <td className="py-2 pr-3">{it.jobName}</td>
                <td className="py-2 pr-3">{it.placeName}</td>
                <td className="py-2 pr-3">
                  {it.duty}
                  {it.isLeader && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#FEF3C7", color: "#92400E" }}>
                      <Crown size={11} /> หัวหน้างาน
                    </span>
                  )}
                </td>
                <td className="py-2 whitespace-nowrap">
                  <Link href={`/dashboard/offsite/${it._id}`} className="underline" style={{ color: "#005CFF" }}>{it.docNo}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
