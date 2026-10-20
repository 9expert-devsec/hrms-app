import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/** An expired / used / invalid reset link: the reason and a way to ask again. */
export default function LinkProblem({ message }) {
  return (
    <div className="space-y-4" data-testid="reset-link-problem">
      <div role="alert" className="flex gap-3 rounded-[var(--9e-radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </div>
      <Link href="/forgot-password" className="inline-flex text-sm font-semibold text-9e-action hover:underline">
        ขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง
      </Link>
    </div>
  );
}
