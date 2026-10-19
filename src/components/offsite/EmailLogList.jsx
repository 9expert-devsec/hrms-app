"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { formatDateTimeTh } from "@/lib/offsiteRules";
import { CARD, INPUT_STYLE, NAVY, SLATE, Chip, ErrorBox, api } from "./ui";

const TYPE_LABELS = {
  offsite_invite: "คำเชิญสมาชิก",
  offsite_members_ready: "สมาชิกตอบรับครบ",
  offsite_approval_pending: "รออนุมัติ",
  offsite_reconfirm: "รอยืนยันอีกครั้ง",
  offsite_returned: "ส่งกลับให้แก้ไข",
  offsite_approved: "อนุมัติแล้ว",
  offsite_cancelled: "ยกเลิก",
};
const STATUS_TONE = { sent: "green", failed: "red", skipped: "grey" };

/** บันทึกการส่งอีเมล — read-only, latest 200 rows. */
export default function EmailLogList() {
  const [status, setStatus] = useState("");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(null);
    setError("");
    api(`/api/email-log${status ? `?status=${status}` : ""}`)
      .then((j) => setItems(j.items || []))
      .catch((e) => setError(e.message));
  }, [status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ color: NAVY, fontSize: "1.5rem", fontWeight: 600 }}>บันทึกการส่งอีเมล</h1>
        <label className="flex items-center gap-2 text-sm" style={{ color: SLATE }}>
          สถานะ
          <select style={{ ...INPUT_STYLE, width: "auto" }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="สถานะ">
            <option value="">ทั้งหมด</option>
            <option value="sent">sent</option>
            <option value="failed">failed</option>
            <option value="skipped">skipped</option>
          </select>
        </label>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <div className="overflow-x-auto p-2" style={CARD}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: SLATE }}>
              <th className="px-3 py-2">เวลา</th>
              <th className="px-3 py-2">ประเภท</th>
              <th className="px-3 py-2">ถึง</th>
              <th className="px-3 py-2">เลขที่</th>
              <th className="px-3 py-2">สถานะ</th>
              <th className="px-3 py-2">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {!items && !error && (
              <tr>
                <td colSpan={6} className="px-3 py-6"><Loader2 className="animate-spin" size={18} /></td>
              </tr>
            )}
            {items && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center" style={{ color: SLATE }}>ยังไม่มีบันทึก</td>
              </tr>
            )}
            {(items || []).map((r) => (
              <tr key={r._id} className="border-t" style={{ borderColor: "#EEF2F7", color: NAVY }}>
                <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDateTimeTh(r.at)}</td>
                <td className="px-3 py-2">{TYPE_LABELS[r.type] || r.type}</td>
                <td className="px-3 py-2">{r.to || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.requestId ? (
                    <Link href={`/dashboard/offsite/${r.requestId}`} className="underline" style={{ color: "#005CFF" }}>{r.docNo || "—"}</Link>
                  ) : (
                    r.docNo || "—"
                  )}
                </td>
                <td className="px-3 py-2"><Chip tone={STATUS_TONE[r.status]}>{r.status}</Chip></td>
                <td className="px-3 py-2 text-xs" style={{ color: SLATE }}>{r.reason || r.postmarkMessageId || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
