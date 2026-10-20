// src/app/api/offsite/requests/[id]/route.js — one off-site request.
// Access (creator / members / approvers / superadmin) and the status machine
// are enforced in lib/offsite.js.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import {
  getRequest,
  updateRequest,
  sendInvitations,
  respondToInvitation,
  submitStep1,
  cancelRequest,
  approveStep,
  rejectStep,
  reconfirmStep,
  saveHrSummary,
  OffsiteError,
  offsiteErrorResponse,
} from "@/lib/offsite";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// offsite_hr holders may read (lib/offsite.js grants them no actions).
async function run(tag, fn) {
  const gate = await requireAnyPageApi(["offsite_self", "offsite_hr"]);
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    return NextResponse.json(await fn(gate.session), { headers: NO_STORE });
  } catch (e) {
    const { body, status } = offsiteErrorResponse(e, tag);
    return NextResponse.json(body, { status });
  }
}

export async function GET(_req, ctx) {
  const { id } = await ctx.params;
  return run("request GET", (session) => getRequest(session, id));
}

/** Edit (creator; draft or returned). Body: same shape as POST /api/offsite/requests. */
export async function PATCH(req, ctx) {
  const { id } = await ctx.params;
  const input = await req.json().catch(() => ({}));
  return run("request PATCH", (session) => updateRequest(session, id, input));
}

/**
 * Actions. Body { action, reason? }:
 *   send     — creator sends / resends invitations
 *   accept   — an invited member signs and accepts (the creator too, unless they lead)
 *   decline  — an invited member declines (reason required)
 *   submit   — the team leader signs step 1
 *   cancel   — creator cancels (reason required)
 *   approve  — the active step's approver signs { step?, hrSummary? (step 3) }
 *   reject   — the active step's approver declines { step?, reason }
 *   reconfirm — a needs_reconfirm step's approver confirms { step? }
 *   hr_summary — step 3 approver saves the HR section { hrSummary }
 */
export async function POST(req, ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return run(`request ${body.action || "?"}`, (session) => {
    switch (body.action) {
      case "send":
        return sendInvitations(session, id);
      case "accept":
      case "decline":
        return respondToInvitation(session, id, { action: body.action, reason: body.reason });
      case "submit":
        return submitStep1(session, id);
      case "cancel":
        return cancelRequest(session, id, { reason: body.reason });
      case "approve":
        return approveStep(session, id, { step: body.step, hrSummary: body.hrSummary });
      case "reject":
        return rejectStep(session, id, { step: body.step, reason: body.reason });
      case "reconfirm":
        return reconfirmStep(session, id, { step: body.step });
      case "hr_summary":
        return saveHrSummary(session, id, body.hrSummary);
      default:
        throw new OffsiteError("action ไม่ถูกต้อง", 400);
    }
  });
}
