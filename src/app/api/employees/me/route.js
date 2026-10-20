// src/app/api/employees/me/route.js — "แก้ไขโปรไฟล์ของฉัน".
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Employee from "@/models/Employee";
import cloudinary from "@/lib/cloudinary";
import { requirePageApi } from "@/lib/rbac/guard";
import { getOwnEmployee } from "@/lib/rbac/scopeQueries";
import { SELF_EDIT_FIELDS, SELF_EDIT_LABELS, validateSelfProfile } from "@/lib/employeeFormRules";

// Same text as components/SelfServiceGate.jsx (a client module; not imported here).
const UNLINKED_MESSAGE = "บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน";
const NO_STORE = { "Cache-Control": "no-store" };
const bad = (message, extra = {}, status = 400) => NextResponse.json({ ok: false, message, ...extra }, { status, headers: NO_STORE });

/** A photo from our own upload route: a secure Cloudinary URL in this cloud, public id under employees/. */
function validPhoto(url, publicId) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return (
    typeof url === "string" &&
    typeof publicId === "string" &&
    !!cloud &&
    url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`) &&
    /^employees\/[\w-]+$/.test(publicId) &&
    url.includes(publicId)
  );
}

/**
 * PATCH { photoUrl?, photoPublicId?, nickName?, phone? } — the caller's OWN
 * linked employee only, and only these fields (SELF_EDIT_FIELDS); any other
 * key is a 400. Names, address, emergency contact, bank and everything else
 * are HR-only (PUT /api/employees/[id], `employees`).
 */
export async function PATCH(req) {
  const gate = await requirePageApi("self_profile");
  if (gate.res) return gate.res;
  try {
    await dbConnect();
    const emp = await getOwnEmployee(gate.session, "_id phone nickName photoUrl photoPublicId");
    if (!emp) return bad(UNLINKED_MESSAGE, {}, 403);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return bad("ข้อมูลไม่ถูกต้อง");
    const extra = Object.keys(body).filter((k) => !SELF_EDIT_FIELDS.includes(k));
    if (extra.length) {
      return bad("แก้ไขได้เฉพาะรูปโปรไฟล์ ชื่อเล่น และเบอร์โทร — ข้อมูลอื่นติดต่อฝ่ายบุคคล (HR)", { fields: extra });
    }
    for (const k of ["nickName", "phone"]) {
      if (k in body && typeof body[k] !== "string") return bad(`${SELF_EDIT_LABELS[k]}ไม่ถูกต้อง`, { field: k });
    }

    const errors = validateSelfProfile(body, { stored: emp });
    if (Object.keys(errors).length) {
      const field = Object.keys(errors)[0];
      return bad(errors[field], { errors, field });
    }

    const update = {};
    if ("nickName" in body) update.nickName = body.nickName.trim();
    if ("phone" in body) update.phone = body.phone.trim();
    if ("photoUrl" in body || "photoPublicId" in body) {
      if (!validPhoto(body.photoUrl, body.photoPublicId)) return bad("รูปโปรไฟล์ไม่ถูกต้อง", { field: "photo" });
      update.photoUrl = body.photoUrl;
      update.photoPublicId = body.photoPublicId;
    }
    if (!Object.keys(update).length) return NextResponse.json({ ok: true }, { headers: NO_STORE });

    await Employee.updateOne({ _id: emp._id }, { $set: { ...update, updatedAt: new Date() } });

    // The replaced photo is removed after the save (same as PUT /api/employees/[id]).
    if (update.photoPublicId && emp.photoPublicId && emp.photoPublicId !== update.photoPublicId) {
      try {
        await cloudinary.uploader.destroy(emp.photoPublicId);
      } catch (e) {
        console.warn("Cloudinary destroy failed:", e?.message);
      }
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    console.error("[employees/me][PATCH] error:", e?.message);
    return NextResponse.json({ ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, { status: 500, headers: NO_STORE });
  }
}
