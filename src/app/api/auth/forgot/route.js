// src/app/api/auth/forgot/route.js — PUBLIC: "ลืมรหัสผ่าน" request (signed out).
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requestPasswordReset } from "@/lib/passwordReset";
import { FORGOT_PASSWORD_GENERIC_MESSAGE } from "@/lib/passwordRules";

const NO_STORE = { "Cache-Control": "no-store" };

/** First hop of X-Forwarded-For (set by the platform), else X-Real-IP. */
function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip") || "").trim().slice(0, 64);
}

/**
 * POST { email } → always 200 with the same message, whether or not the
 * account exists, is a company address, is suspended or is rate limited
 * (lib/passwordReset.js decides; the email goes out after the response).
 */
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  try {
    await dbConnect();
    await requestPasswordReset({ email: typeof body?.email === "string" ? body.email : "", ip: clientIp(req) });
  } catch (e) {
    console.error("[password-reset] request failed:", e?.message);
  }
  return NextResponse.json({ ok: true, message: FORGOT_PASSWORD_GENERIC_MESSAGE }, { headers: NO_STORE });
}
