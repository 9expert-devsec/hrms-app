"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus, MapPin, CalendarDays, Clock } from "lucide-react";
import { formatWorkDateTh, PROGRESS_STEPS } from "@/lib/offsiteRules";
import { CARD, NAVY, SLATE, BLUE, Button, ErrorBox, StatusChip, MemberStatusChip, api } from "./ui";

const TABS = [
  { key: "mine", label: "คำขอของฉัน" },
  { key: "invites", label: "คำเชิญที่รอฉัน" },
  { key: "member", label: "ที่ฉันร่วมเดินทาง" },
];

export default function OffsiteList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = TABS.some((t) => t.key === searchParams.get("tab")) ? searchParams.get("tab") : "mine";
  const [items, setItems] = useState(null);
  const [inviteCount, setInviteCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(null);
    setError("");
    api(`/api/offsite/requests?box=${tab}`)
      .then((j) => setItems(j.items || []))
      .catch((e) => setError(e.message));
    api("/api/offsite/count")
      .then((j) => setInviteCount(j.invites || 0))
      .catch(() => {});
  }, [tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ color: NAVY, fontSize: "1.5rem", fontWeight: 600 }}>ทำงานนอกสถานที่</h1>
        <Button onClick={() => router.push("/dashboard/offsite/new")}>
          <Plus size={14} /> สร้างคำขอ
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/dashboard/offsite?tab=${t.key}`}
              role="tab"
              aria-selected={active}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
              style={{ background: active ? BLUE : "#FFFFFF", color: active ? "#FFFFFF" : NAVY, border: "1px solid rgba(0,92,255,0.15)" }}
            >
              {t.label}
              {t.key === "invites" && inviteCount > 0 && (
                <span className="rounded-full px-1.5 text-xs font-bold" style={{ background: "#DC2626", color: "#FFFFFF" }}>
                  {inviteCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <ErrorBox>{error}</ErrorBox>
      {!items && !error && <Loader2 className="animate-spin" size={18} />}
      {items && items.length === 0 && (
        <div className="p-8 text-center text-sm" style={{ ...CARD, color: SLATE }}>
          {tab === "invites" ? "ไม่มีคำเชิญที่รอคุณตอบ" : "ยังไม่มีคำขอ"}
        </div>
      )}

      <ul className="space-y-3">
        {(items || []).map((it) => (
          <li key={it._id}>
            <Link href={`/dashboard/offsite/${it._id}`} className="block p-5 transition hover:-translate-y-0.5" style={CARD}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs" style={{ color: SLATE }}>
                    {it.docNo}
                    {tab !== "mine" && ` · โดย ${it.creatorNameTh}`}
                  </div>
                  <div className="font-semibold" style={{ color: NAVY }}>{it.jobName}</div>
                  <div className="mt-1 flex flex-wrap gap-4 text-xs" style={{ color: SLATE }}>
                    <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {formatWorkDateTh(it.workDate)}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={12} /> {it.startTime}–{it.endTime}</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={12} /> {it.placeName}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusChip status={it.status} />
                  {tab !== "mine" && it.myStatus && <MemberStatusChip status={it.myStatus} />}
                  <span className="text-xs" style={{ color: SLATE }}>
                    ตอบรับ {it.acceptedCount}/{it.memberCount} · {it.status === "cancelled" ? "ยกเลิก" : PROGRESS_STEPS[it.progress.position]}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
