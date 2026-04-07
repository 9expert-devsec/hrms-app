import cloudinary from "@/lib/cloudinary";

export const runtime = "nodejs";

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp)$/i;
const DOC_EXTS = /\.(pdf|doc|docx|xls|xlsx)$/i;
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ error: "NO_FILE" }, { status: 400 });
    }

    const filename = file.name || "";
    const isImage = IMAGE_EXTS.test(filename);
    const isDoc = DOC_EXTS.test(filename);

    if (!isImage && !isDoc) {
      return Response.json(
        { error: "INVALID_TYPE", allowed: "JPG, PNG, GIF, WEBP, PDF, DOC, DOCX, XLS, XLSX" },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: "TOO_LARGE", maxSize: "10MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: "hrms/leave-attachments",
          resource_type: isImage ? "image" : "raw",
          type: "upload",
          access_mode: "public",
          public_id: `${Date.now()}-${safeName}`,
        },
        (error, res) => {
          if (error) reject(error);
          else resolve(res);
        }
      ).end(buffer);
    });

    return Response.json({
      url: result.secure_url,
      publicId: result.public_id,
      name: file.name,
      type: isImage ? "image" : "document",
      size: file.size,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return Response.json({ error: err?.message || "Upload failed" }, { status: 500 });
  }
}
