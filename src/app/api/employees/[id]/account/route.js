// src/app/api/employees/[id]/account/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAnyPageApi } from "@/lib/rbac/guard";
import { AccountError } from "@/lib/accounts";
import {
  getEmployeeAccount,
  createAccountForEmployee,
  linkAccount,
  unlinkAccount,
} from "@/lib/accountLinks";

/**
 * The employee's login account (lib/accountLinks.js), for employees holders
 * and the superadmin:
 *   GET    → { account | null, candidates: unlinked accounts }
 *   POST   { email?, role? } → create one (temporary password, shown once)
 *   PUT    { userId }        → link an existing unlinked account
 *   DELETE                   → unlink (the account stays)
 */

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

async function run(handler, label) {
  try {
    const gate = await requireAnyPageApi(["employees"]);
    if (gate.res) return gate.res;
    await dbConnect();
    return await handler(gate.session.user);
  } catch (err) {
    if (err instanceof AccountError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: err.status, headers: NO_STORE });
    }
    console.error(`${label} /api/employees/[id]/account error:`, err?.message);
    return NextResponse.json({ ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, { status: 500, headers: NO_STORE });
  }
}

export async function GET(_req, { params }) {
  const { id } = await params;
  return run(async (actor) => {
    const data = await getEmployeeAccount(id, { actor });
    return NextResponse.json({ ok: true, ...data }, { headers: NO_STORE });
  }, "GET");
}

export async function POST(req, { params }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return run(async (actor) => {
    const { account, tempPassword } = await createAccountForEmployee(
      id,
      { email: body?.email, role: body?.role },
      { actor }
    );
    // tempPassword: shown ONCE (TempPasswordDialog); never logged.
    return NextResponse.json({ ok: true, account, tempPassword }, { status: 201, headers: NO_STORE });
  }, "POST");
}

export async function PUT(req, { params }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return run(async (actor) => {
    const { account } = await linkAccount(id, body?.userId, { actor });
    return NextResponse.json({ ok: true, account }, { headers: NO_STORE });
  }, "PUT");
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  return run(async (actor) => {
    const item = await unlinkAccount(id, { actor });
    return NextResponse.json({ ok: true, item }, { headers: NO_STORE });
  }, "DELETE");
}
