// src/app/api/roles/[key]/route.js — edit / delete one role (superadmin only)
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireSuperadminApi } from "@/lib/rbac/guard";
import { saveRole, deleteRole, RoleError } from "@/lib/rbac/roles";

function fail(err, where) {
  if (err instanceof RoleError) {
    return NextResponse.json({ ok: false, message: err.message, ...err.extra }, { status: err.status });
  }
  console.error(where, err);
  return NextResponse.json({ ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, { status: 500 });
}

/** Update name, colour and pages: { name, color, pages }. The key never changes. */
export async function PUT(req, { params }) {
  try {
    const gate = await requireSuperadminApi();
    if (gate.res) return gate.res;

    const { key } = await params;
    const body = await req.json().catch(() => ({}));
    await dbConnect();
    const item = await saveRole(key, body, gate.session.user);
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return fail(err, "PUT /api/roles/[key] error:");
  }
}

/** Delete a custom role. 409 (with userCount) while users still have it. */
export async function DELETE(_req, { params }) {
  try {
    const gate = await requireSuperadminApi();
    if (gate.res) return gate.res;

    const { key } = await params;
    await dbConnect();
    return NextResponse.json({ ok: true, item: await deleteRole(key) });
  } catch (err) {
    return fail(err, "DELETE /api/roles/[key] error:");
  }
}
