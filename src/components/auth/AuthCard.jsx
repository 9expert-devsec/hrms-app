import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Signed-out page shell (ลืมรหัสผ่าน / ตั้งรหัสผ่านใหม่): logo, eyebrow, title, card. */
export default function AuthCard({ eyebrow, title, subtitle, children }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-9e-ice px-4 py-10">
      <div className="w-full max-w-[460px]">
        <div className="mb-6 flex justify-center">
          <Image src="/brand/logo-blue-ink.png" alt="9Expert" width={960} height={315} className="h-auto w-[150px]" sizes="150px" priority />
        </div>
        <div className="rounded-2xl border border-[var(--surface-border)] bg-white p-6 shadow-[0_8px_24px_-12px_rgb(13_27_42/0.18)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-9e-action">{eyebrow}</p>
          <h1 className="mt-2 text-[24px] leading-tight text-9e-navy sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] text-[var(--text-secondary)]">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <div className="mt-6 text-center">
          <Link href="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-9e-action hover:underline">
            <ArrowLeft size={14} /> กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}

export const authInputClass =
  "h-[52px] w-full rounded-[var(--9e-radius-md)] border border-[var(--surface-border)] bg-white pl-11 pr-4 text-[15px] text-9e-navy placeholder:text-[var(--text-muted)]";

export const authButtonClass =
  "inline-flex h-14 w-full items-center justify-center gap-2 rounded-[var(--9e-radius-md)] bg-9e-lime text-base font-bold text-9e-navy transition-colors enabled:hover:bg-9e-lime-dk disabled:cursor-not-allowed disabled:opacity-70";
