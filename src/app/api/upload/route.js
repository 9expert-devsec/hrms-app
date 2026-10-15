// src/app/api/upload/route.js
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireSessionAPI } from "@/lib/authz";
import { checkUpload } from "@/lib/server/uploadRules";

export const runtime = "nodejs"; // ต้องใช้ Node runtime เพราะใช้ cloudinary sdk

// ตั้งค่าจาก .env.local
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// AUTH-ONLY: employee photo upload from the employee create / edit forms
// (own profile included); the file only gets used by a guarded save.
export async function POST(req) {
  try {
    const gate = await requireSessionAPI();
    if (gate.res) return gate.res;

    // เช็ค env ก่อน (กันเคสค่าหายแล้วขึ้น 500 เงียบ ๆ)
    if (!process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json(
        { error: "Cloudinary env is not configured" },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file"); // ← ต้องชื่อ 'file' ให้ตรงกับฝั่ง client

    // Image or PDF, at most 10 MB (MIME type and extension must agree).
    const check = checkUpload(file);
    if (!check.ok) {
      return NextResponse.json(
        { error: check.error, allowed: "JPG, PNG, GIF, WEBP, PDF", maxSize: "10MB" },
        { status: check.status }
      );
    }

    // แปลงไฟล์เป็น buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // อัปโหลดขึ้น Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "employees", resource_type: "image" },
          (err, res) => (err ? reject(err) : resolve(res))
        )
        .end(buffer);
    });

    return NextResponse.json({
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
