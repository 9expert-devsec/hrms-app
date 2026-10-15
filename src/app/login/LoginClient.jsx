"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  Eye,
  EyeOff,
  LogIn,
  Mail,
  Lock,
  Users,
  BarChart3,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "จัดการข้อมูลพนักงานได้ครบถ้วน",
    desc: "ข้อมูลบุคลากร โครงสร้างองค์กร และประวัติการทำงาน",
  },
  {
    icon: BarChart3,
    title: "รายงานและ Analytics แบบ Real-time",
    desc: "สรุปข้อมูลเชิงลึก ช่วยให้การตัดสินใจง่ายขึ้น",
  },
  {
    icon: ShieldCheck,
    title: "ระบบสิทธิ์ RBAC ปลอดภัยสูง",
    desc: "กำหนดสิทธิ์ตาม Role พร้อมมาตรฐานความปลอดภัย",
  },
];

// Only same-origin paths. "//host" and "/\host" are protocol-relative in
// browsers, so both would be open redirects.
function safeCallbackUrl(raw) {
  if (!raw || !raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/dashboard";
  return raw;
}

function Logo({ tone }) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/logo-9hrms.png"
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 object-contain"
        priority
      />
      <div className="flex flex-col leading-tight">
        <p
          className={`text-lg font-extrabold ${
            tone === "light" ? "text-white" : "text-9e-navy"
          }`}
        >
          9Expert
        </p>
        <p
          className={`text-[11px] ${
            tone === "light" ? "text-9e-ice/70" : "text-[var(--text-muted)]"
          }`}
        >
          Knowledge Provider
        </p>
      </div>
    </div>
  );
}

const inputClass =
  "h-[52px] w-full rounded-[var(--9e-radius-md)] border border-[var(--surface-border)] bg-white pl-11 text-[15px] text-9e-navy placeholder:text-[var(--text-muted)]";

export default function LoginClient() {
  const router = useRouter();
  const search = useSearchParams();
  const queryError = search.get("error");
  const callbackUrl = safeCallbackUrl(search.get("callbackUrl"));

  const errorFromQuery = useMemo(() => {
    if (!queryError) return "";
    switch (queryError) {
      case "CredentialsSignin":
        return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      default:
        return "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง";
    }
  }, [queryError]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(errorFromQuery);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });
    setLoading(false);
    if (!res) {
      setErr("เกิดข้อผิดพลาดที่ไม่คาดคิด");
      return;
    }
    if (res.error) {
      setErr(errorFromQuery || "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }
    router.push(callbackUrl);
  }

  const errorText = err || errorFromQuery;

  return (
    <div className="flex min-h-dvh lg:h-dvh lg:overflow-hidden">
      {/* ── Left: aurora brand panel ─────────────────────────── */}
      <section className="relative hidden overflow-hidden bg-9e-navy lg:flex lg:w-[58%]">
        <div className="hr-aurora" aria-hidden="true" />
        <div className="hr-aurora-scrim" aria-hidden="true" />

        <div className="relative z-10 flex h-full w-full items-center pl-16 pr-10">
          <div className="max-w-[520px]">
            <Logo tone="light" />

            <div className="mt-10 flex items-center gap-3">
              <div className="h-0.5 w-8 rounded-full bg-9e-lime" />
              <p className="text-sm font-semibold tracking-wide text-9e-ice/80">
                9Expert HRMS
              </p>
            </div>

            <h1 className="mt-4 text-[40px] leading-[1.15] text-white xl:text-[48px]">
              Human Resource
              <br />
              <strong className="font-bold text-9e-lime">
                Management System
              </strong>
            </h1>

            <p className="mt-5 text-base leading-relaxed text-9e-ice/80">
              ระบบบริหารทรัพยากรบุคคลภายในองค์กร ครบวงจร ปลอดภัย และใช้งานง่าย
              เพื่อสนับสนุนการทำงานของทุกทีมใน 9Expert
            </p>

            <ul className="mt-10 space-y-5">
              {features.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-center gap-4">
                  {/* bg-white/[0.1], not bg-white/10: the latter is forced to
                      solid white by the DARK → LIGHT overrides in globals.css */}
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--9e-radius-md)] bg-white/[0.1] ring-1 ring-white/15">
                    <Icon size={22} className="text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{title}</p>
                    <p className="mt-0.5 text-sm text-9e-ice/70">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="absolute bottom-8 left-16 z-10 text-xs text-9e-ice/60">
          © {new Date().getFullYear()} 9Expert Company Limited •
          สำหรับบุคลากรภายในเท่านั้น
        </p>
      </section>

      {/* ── Right: form panel ────────────────────────────────── */}
      <section className="hr-login-surface relative flex flex-1 items-center justify-center overflow-y-auto px-4 py-10 sm:px-8 lg:px-12">
        <div className="hr-login-hairlines" aria-hidden="true" />

        <div className="relative z-10 w-full max-w-[440px]">
          <div className="mb-8 lg:hidden">
            <Logo tone="dark" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-9e-action">
            WELCOME BACK
          </p>
          <h2 className="mt-2 text-[28px] leading-tight text-9e-navy sm:text-[32px]">
            เข้าสู่ระบบ 9Expert HRMS
          </h2>
          <p className="mt-2 text-[15px] text-[var(--text-secondary)]">
            กรุณาเข้าสู่ระบบด้วยบัญชีผู้ใช้งานของบริษัท
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-9e-navy"
              >
                อีเมล
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${inputClass} pr-4`}
                  placeholder="you@9expert.co.th"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold text-9e-navy"
              >
                รหัสผ่าน
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-12`}
                  placeholder="กรอกรหัสผ่าน"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-[var(--9e-radius-md)] text-[var(--text-muted)] transition-colors hover:text-9e-action"
                  aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm font-semibold text-9e-action hover:underline"
                >
                  ลืมรหัสผ่าน?
                </Link>
              </div>
            </div>

            {errorText && (
              <div
                role="alert"
                className="rounded-[var(--9e-radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {errorText}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[var(--9e-radius-md)] bg-9e-lime text-base font-bold text-9e-navy shadow-[0_8px_20px_-8px_rgb(var(--shadow-color)/0.45)] transition-colors enabled:hover:bg-9e-lime-lt enabled:active:bg-9e-lime-dk disabled:cursor-not-allowed disabled:opacity-70"
            >
              <LogIn size={18} aria-hidden="true" />
              {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>

          <div className="mt-8 border-t border-[var(--surface-divider)] pt-6 text-center">
            <p className="font-semibold text-9e-navy">
              ระบบสำหรับบุคลากร 9Expert เท่านั้น
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              หากพบปัญหาการเข้าสู่ระบบ กรุณาติดต่อฝ่าย IT
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
