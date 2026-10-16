// src/app/api/roles/route.js — roles editor (superadmin only)
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireSuperadminApi } from "@/lib/rbac/guard";
import { listRoles, createRole, RoleError } from "@/lib/rbac/roles";

function fail(err, where) {
  if (err instanceof RoleError) {
    return NextResponse.json({ ok: false, message: err.message, ...err.extra }, { status: err.status });
  }
  console.error(where, err);
  return NextResponse.json({ ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, { status: 500 });
}

export async function GET() {
  try {
    const gate = await requireSuperadminApi();
    if (gate.res) return gate.res;

    await dbConnect();
    return NextResponse.json({ ok: true, items: await listRoles() });
  } catch (err) {
    return fail(err, "GET /api/roles error:");
  }
}

/** Create a custom role: { key, name, color, pages }. */
export async function POST(req) {
  try {
    const gate = await requireSuperadminApi();
    if (gate.res) return gate.res;

    const body = await req.json().catch(() => ({}));
    await dbConnect();
    const item = await createRole(body, gate.session.user);
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (err) {
    return fail(err, "POST /api/roles error:");
  }
}
