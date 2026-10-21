"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus, MapPin, CalendarDays, Clock } from "lucide-react";
import { APPROVAL_ASK_LABELS, formatWorkDateTh, PROGRESS_STEPS } from "@/lib/offsiteRules";
import { useVersionWatch } from "../useVisibilityPoll";
import { refreshInbox } from "../inbox/InboxProvider";
import { CARD, NAVY, SLATE, BLUE, Button, Chip, ErrorBox, LiveToast, StatusChip, MemberStatusChip, api } from "./ui";
import OffsiteHistory from "./OffsiteHistory";

const TOAST_MS = 3000;

// `countKey`: field of GET /api/offsite/count shown as a red count on the tab.
const TABS = [
  { key: "mine", label: "คำขอของฉัน" },
  { key: "invites", label: "คำเชิญที่รอฉัน", countKey: "invites" },
  { key: "approvals", label: "รอฉันอนุมัติ", countKey: "approvals" },
  { key: "member", label: "ที่ฉันร่วมเดินทาง" },
  { key: "approved_by_me", label: "ที่ฉันเคยอนุมัติ" },
  { key: "history", label: "ประวัติของฉัน" },
];

const EMPTY = {
  invites: "ไม่มีคำเชิญที่รอคุณตอบ",
  approvals: "ไม่มีคำขอที่รอคุณอนุมัติ",
  approved_by_me: "ยังไม่มีคำขอที่คุณเคยอนุมัติ",
};

export default function OffsiteList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = TABS.some((t) => t.key === searchParams.get("tab")) ? searchParams.get("tab") : "mine";
  const [items, setItems] = useState(null);
  const [counts, setCounts] = useState({});
  const [error, setError] = useState("");
  const [version, setVersion] = useState("");
  const [historyKey, setHistoryKey] = useState(0);
  const [toast, setToast] = useState(false);
  const toastTimer = useRef(null);

  // `quiet`: a live refresh — keep the current list on screen while it reloads.
  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setItems(null);
        setError("");
      }
      const jobs = [api("/api/offsite/count").then(setCounts).catch(() => {})];
      if (tab === "history") {
        jobs.push(api(`/api/offsite/version?scope=history`).then((j) => setVersion(j.version)).catch(() => {}));
        if (quiet) setHistoryKey((k) => k + 1);
      } else {
        jobs.push(
          api(`/api/offsite/requests?box=${tab}`)
            .then((j) => {
              setItems(j.items || []);
              setVersion(j.version || "");
            })
            .catch((e) => setError(e.message))
        );
      }
      await Promise.all(jobs);
    },
    [tab]
  );

  useEffect(() => {
    setVersion("");
    load();
  }, [load]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);
  // Live status: when what this tab shows (or its badges) changes, reload it in place.
  useVersionWatch(`/api/offsite/version?scope=${tab}`, version, async () => {
    await load(true);
    refreshInbox();
    setToast(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), TOAST_MS);
  });

  return (
    <div className="space-y-6">
      <LiveToast show={toast} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ color: NAVY, fontSize: "1.5rem", fontWeight: 600 }}>ทำงานนอกสถานที่</h1>
        <Button className="touch-44" onClick={() => router.push("/dashboard/offsite/new")}>
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
              className="touch-44 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
              style={{ background: active ? BLUE : "#FFFFFF", color: active ? "#FFFFFF" : NAVY, border: "1px solid rgba(0,92,255,0.15)" }}
            >
              {t.label}
              {t.countKey && counts[t.countKey] > 0 && (
                <span className="rounded-full px-1.5 text-xs font-bold" style={{ background: "#DC2626", color: "#FFFFFF" }}>
                  {counts[t.countKey]}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {tab === "history" && (
        <section className="space-y-3 p-5" style={CARD}>
          <h2 style={{ color: NAVY, fontWeight: 600 }}>ประวัติทำงานนอกสถานที่ของฉัน</h2>
          <OffsiteHistory key={historyKey} />
        </section>
      )}

      <ErrorBox>{error}</ErrorBox>
      {tab !== "history" && !items && !error && <Loader2 className="animate-spin" size={18} />}
      {items && items.length === 0 && (
        <div className="p-8 text-center text-sm" style={{ ...CARD, color: SLATE }}>
          {EMPTY[tab] || "ยังไม่มีคำขอ"}
        </div>
      )}

      <ul className="space-y-3">
        {(items || []).map((it) => (
          <li key={it._id}>
            <Link href={`/dashboard/offsite/${it._id}`} className="block p-5 transition hover:-translate-y-0.5" style={CARD}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs" style={{ color: SLATE }}>
                    {it.docNo || "ยังไม่ออกเลข"}
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
                  {tab === "approvals" && it.activeStepStatus && (
                    <Chip tone={it.activeStepStatus === "needs_reconfirm" ? "amber" : "blue"}>
                      ขั้นที่ {it.activeStep} · {APPROVAL_ASK_LABELS[it.activeStepStatus] || "รออนุมัติ"}
                    </Chip>
                  )}
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
