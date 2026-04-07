"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Eye, EyeOff, LogIn, Users, BarChart2, Shield } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const queryError = search.get("error");

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
      callbackUrl: "/dashboard",
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
    router.push(res.url || "/dashboard");
  }

  return (
    <div className="min-h-dvh flex">
      
      {/* ── Left: Brand Panel (Deep Navy + Lime) ─────────────── */}
      <div
        className="hidden lg:flex lg:w-[48%] flex-col justify-between px-12 py-10"
        style={{ background: "#0D1B2A" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl grid place-items-center"
            style={{ background: "#005CFF" }}
          >
            <span className="text-white font-extrabold text-lg">9</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-extrabold text-white text-base">9Expert</span>
            <span className="text-[11px]" style={{ color: "#808A95" }}>
              Knowledge Provider
            </span>
          </div>
        </div>

        {/* Center */}
        <div>
          {/* Lime headline — signature 9Expert look */}
          <h2
            className="text-3xl font-extrabold leading-snug mb-3"
            style={{ color: "#D4F73F" }}
          >
            Human Resource
            <br />
            Management System
          </h2>
          <p
            className="text-sm leading-relaxed max-w-sm mb-10"
            style={{ color: "#808A95" }}
          >
            ระบบบริหารทรัพยากรบุคคลภายในองค์กร ครบวงจร ปลอดภัย และใช้งานง่าย
          </p>

          {/* Feature list */}
          <div className="space-y-4">
            {[
              { icon: Users, text: "จัดการข้อมูลพนักงานได้ครบถ้วน" },
              { icon: BarChart2, text: "รายงานและ Analytics แบบ Real-time" },
              { icon: Shield, text: "ระบบสิทธิ์ RBAC ปลอดภัยสูง" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3 text-sm"
                style={{ color: "#808A95" }}
              >
                <div
                  className="h-9 w-9 rounded-lg grid place-items-center shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <Icon size={15} style={{ color: "#48B0FF" }} />
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs" style={{ color: "#808A95" }}>
          © {new Date().getFullYear()} 9 Expert Company Limited ·
          อย่าหยุดเรียนรู้
        </p>
      </div>

      {/* ── Right: Form Panel ───────────────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-10"
        style={{ background: "#F8FAFD" }}
      >
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2.5 mb-8">
          <div
            className="h-9 w-9 rounded-xl grid place-items-center"
            style={{ background: "#005CFF" }}
          >
            <span className="text-white font-extrabold">9</span>
          </div>
          <span className="font-extrabold" style={{ color: "#0D1B2A" }}>
            9Expert HRM
          </span>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-7">
            <h1
              className="text-2xl font-extrabold"
              style={{ color: "#0D1B2A" }}
            >
              Sign in
            </h1>
            <p className="text-sm mt-1" style={{ color: "#808A95" }}>
              Internal system — please use your company account.
            </p>
          </div>

          {/* Error */}
          {(err || errorFromQuery) && (
            <div
              className="mb-4 rounded-xl px-4 py-3 text-sm font-medium"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#DC2626",
              }}
            >
              {err || errorFromQuery}
            </div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "#0D1B2A" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-9e"
                placeholder="you@9expert.co.th"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "#0D1B2A" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-9e"
                  style={{ paddingRight: "3rem" }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute inset-y-0 right-0 px-3 transition-colors duration-200"
                  style={{ color: "#808A95" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#005CFF")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#808A95")
                  }
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label
                className="inline-flex items-center gap-2 text-sm"
                style={{ color: "#808A95" }}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded"
                  style={{ accentColor: "#005CFF" }}
                  disabled
                />
                Remember me (coming soon)
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-semibold transition-colors duration-200"
                style={{ color: "#005CFF" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#0D1B2A")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#005CFF")}
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit — Lime CTA (signature 9Expert) */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-bold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 disabled:opacity-60"
              style={{ background: "#D4F73F", color: "#0D1B2A" }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.background = "#E4FF6B";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#D4F73F";
              }}
            >
              <LogIn size={17} />
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* RBAC note */}
          <p
            className="mt-6 text-xs leading-relaxed"
            style={{ color: "#808A95" }}
          >
            Access is role-based (RBAC). หากคุณยังไม่มีสิทธิ์ โปรดติดต่อ HR/IT
            เพื่อขอเพิ่ม Role ตามตารางหน้าที่ในระบบ
          </p>
        </div>
      </div>
    </div>
  );
}
