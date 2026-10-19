// src/app/api/offsite/requests/[id]/route.js — one off-site request.
// Access (creator / members / approvers / superadmin) and the status machine
// are enforced in lib/offsite.js.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requirePageApi } from "@/lib/rbac/guard";
import {
  getRequest,
  updateRequest,
  sendInvitations,
  respondToInvitation,
  submitStep1,
  cancelRequest,
  OffsiteError,
  offsiteErrorResponse,
} from "@/lib/offsite";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

async function run(tag, fn) {
  const gate = await requirePageApi("offsite_self");
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
 *   accept   — an invited member signs and accepts
 *   decline  — an invited member declines (reason required)
 *   submit   — creator signs step 1
 *   cancel   — creator cancels (reason required)
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
      default:
        throw new OffsiteError("action ไม่ถูกต้อง", 400);
    }
  });
}
