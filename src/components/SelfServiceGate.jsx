"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { UserX } from "lucide-react";
import { resolvePageKey } from "@/lib/rbac/pages";

/**
 * An account with no linked employee (lib/accountLinks.js — linking is
 * optional) can sign in but has no self-service data. On a self_* page it
 * gets this notice instead of the page; the dashboard shows it as a banner.
 * `?id=` views (someone else's profile / leave document, opened from an
 * approver or HR screen) are not self-service and pass through — their own
 * guards decide.
 *
 * `linked` comes from the protected layout (Employee.userId, read per request).
 */
export const UNLINKED_MESSAGE = "บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน";

export function UnlinkedNotice({ compact = false }) {
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-2xl ${compact ? "px-4 py-3 mb-6" : "px-6 py-6"}`}
      style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}
    >
      <UserX size={compact ? 18 : 22} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: compact ? 14 : 16 }}>{UNLINKED_MESSAGE}</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          หน้าข้อมูลส่วนตัว (โปรไฟล์ การลา เวลาทำงาน OT) ใช้ได้เมื่อบัญชีผูกกับพนักงานแล้ว — ติดต่อฝ่ายบุคคล (HR)
        </div>
      </div>
    </div>
  );
}

export default function SelfServiceGate({ linked, children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (linked) return children;

  const key = resolvePageKey(pathname);
  if (key === "dashboard") {
    return (
      <>
        <UnlinkedNotice compact />
        {children}
      </>
    );
  }
  if (key?.startsWith("self_") && !searchParams.get("id")) return <UnlinkedNotice />;
  return children;
}
