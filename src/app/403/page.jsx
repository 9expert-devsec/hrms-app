import Link from "next/link";
import BackBtn from "./BackBtn";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";

export const metadata = { title: "403 • Forbidden" };

export default function ForbiddenPage() {
  return (
    <div className="px-6 py-16 min-h-[60vh] grid place-items-center">
      <div className="max-w-xl w-full rounded-2xl bg-white/5 ring-1 ring-white/10 p-8 text-center space-y-6">
        <div className="flex justify-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 ring-1 ring-white/10">
            <ShieldAlert className="text-red-300" size={28} />
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-slate-100">403 — Forbidden</h1>
        <p className="text-slate-400">
          คุณไม่มีสิทธิ์เข้าถึงหน้านี้ หากคิดว่าเป็นความผิดพลาด
          กรุณาติดต่อผู้ดูแลระบบ/HR
        </p>

        <div className="flex items-center justify-center gap-3 pt-2">
          <BackBtn className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 ring-1 ring-white/10">
            <ArrowLeft size={16} />
            Back
          </BackBtn>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 bg-indigo-600/90 hover:bg-indigo-600 text-white ring-1 ring-white/10"
          >
            <Home size={16} />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
