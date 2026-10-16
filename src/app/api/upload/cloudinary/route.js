import cloudinary from "@/lib/cloudinary";
import { requireSessionAPI } from "@/lib/authz";
import { checkUpload, tooLargeRequest, uploadErrorText } from "@/lib/server/uploadRules";

export const runtime = "nodejs";

// AUTH-ONLY: any signed-in user attaches files to their own leave request.
export async function POST(req) {
  try {
    const gate = await requireSessionAPI();
    if (gate.res) return gate.res;

    // Over the limit by Content-Length: refuse before reading the body.
    const tooLarge = tooLargeRequest(req);
    if (tooLarge) return Response.json(tooLarge, { status: 413 });

    const form = await req.formData();
    const file = form.get("file");

    // Image or PDF, at most 4 MB (MIME type and extension must agree).
    const check = checkUpload(file);
    if (!check.ok) {
      return Response.json(
        { error: check.error, message: uploadErrorText(check.error), allowed: "JPG, PNG, GIF, WEBP, PDF", maxSize: "4MB" },
        { status: check.status }
      );
    }
    const filename = file.name || "";
    const isImage = check.kind === "image";

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
