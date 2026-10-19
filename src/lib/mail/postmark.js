import "server-only";
import mongoose from "mongoose";
import { ServerClient } from "postmark";
import { after } from "next/server";
import EmailLog from "@/models/EmailLog";

/**
 * Outgoing email through Postmark. Config from env only:
 *   POSTMARK_SERVER_TOKEN  (secret — never logged)
 *   POSTMARK_FROM_EMAIL    (shown as "9Expert HRMS <address>")
 * Kill switch: either one missing → every send is skipped and logged as
 * `skipped: disabled`, and the app works normally without email.
 *
 * Email never breaks a workflow: sendMail never throws, and callers send
 * only after their DB change is saved (runAfterResponse).
 */

const MESSAGE_STREAM = "outbound";
const TIMEOUT_SECONDS = 5;

export function mailConfig() {
  const token = process.env.POSTMARK_SERVER_TOKEN || "";
  const from = process.env.POSTMARK_FROM_EMAIL || "";
  return { enabled: !!token && !!from, token, from };
}

/** Absolute link into the app (NEXTAUTH_URL is the base). */
export function appUrl(path) {
  const base = (process.env.NEXTAUTH_URL || "").replace(/\/+$/, "");
  return `${base}${path}`;
}

let cached = null; // { token, client }
function clientFor(token) {
  if (!cached || cached.token !== token) cached = { token, client: new ServerClient(token, { timeout: TIMEOUT_SECONDS }) };
  return cached.client;
}

async function writeLog(row) {
  try {
    await EmailLog.create(row);
  } catch (e) {
    console.error("[mail] could not write EmailLog:", e?.message || e);
  }
}

/**
 * Send one email and log the attempt. `tag` is the email type (also stored
 * as EmailLog.type); `metadata` { requestId, docNo } goes to Postmark as
 * strings and to the log. Returns { status, messageId?, reason? }; never throws.
 * `to` null/empty → skipped: no-address.
 */
export async function sendMail({ to, subject, html, text, tag = "", metadata = {} }) {
  const base = {
    at: new Date(),
    to: to || "",
    type: tag,
    requestId: mongoose.isValidObjectId(metadata.requestId) ? metadata.requestId : null,
    docNo: metadata.docNo || "",
  };
  const config = mailConfig();
  if (!config.enabled) {
    await writeLog({ ...base, status: "skipped", reason: "disabled" });
    return { status: "skipped", reason: "disabled" };
  }
  if (!to) {
    await writeLog({ ...base, status: "skipped", reason: "no-address" });
    return { status: "skipped", reason: "no-address" };
  }
  try {
    const res = await clientFor(config.token).sendEmail({
      From: `9Expert HRMS <${config.from}>`,
      To: to,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
      Tag: tag || undefined,
      Metadata: Object.fromEntries(Object.entries(metadata).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])),
      MessageStream: MESSAGE_STREAM,
    });
    if (res?.ErrorCode) throw new Error(`Postmark ${res.ErrorCode}: ${res.Message}`);
    await writeLog({ ...base, status: "sent", postmarkMessageId: res?.MessageID || "" });
    return { status: "sent", messageId: res?.MessageID };
  } catch (e) {
    const reason = String(e?.message || e).slice(0, 300);
    console.error("[mail] send failed:", tag, reason);
    await writeLog({ ...base, status: "failed", reason });
    return { status: "failed", reason };
  }
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve({ timedOut: true }), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Run `task` once the response is sent (Next's after(), which keeps the
 * serverless function alive until it finishes). Outside a request — scripts,
 * tests — after() throws, so the task is awaited here with a ~5 s cap.
 * Errors are logged, never thrown.
 */
export async function runAfterResponse(task) {
  const safe = async () => {
    try {
      await task();
    } catch (e) {
      console.error("[mail] background task failed:", e?.message || e);
    }
  };
  try {
    after(safe);
  } catch {
    await withTimeout(safe(), (TIMEOUT_SECONDS + 1) * 1000);
  }
}
