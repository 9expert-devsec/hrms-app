// Server Component — checks the emailed link before showing the form.
import dbConnect from "@/lib/mongoose";
import { verifyResetToken } from "@/lib/passwordReset";
import AuthCard from "../../components/auth/AuthCard";
import LinkProblem from "./LinkProblem";
import ResetPasswordForm from "./ResetPasswordForm";

export const dynamic = "force-dynamic";
// The URL carries the token: never send it on as a Referer.
export const metadata = { title: "ตั้งรหัสผ่านใหม่", referrer: "no-referrer", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }) {
  const sp = await searchParams;
  const token = typeof sp?.token === "string" ? sp.token : "";
  await dbConnect();
  const check = await verifyResetToken(token);

  return (
    <AuthCard eyebrow="RESET PASSWORD" title="ตั้งรหัสผ่านใหม่" subtitle={check.ok ? "กรอกรหัสผ่านใหม่สำหรับบัญชีของคุณ" : null}>
      {check.ok ? <ResetPasswordForm token={token} /> : <LinkProblem message={check.message} />}
    </AuthCard>
  );
}
