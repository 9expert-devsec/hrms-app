// src/lib/server/uploadRules.js
// Server-side file rule for every upload route: an image or a PDF, at most
// 4 MB (lib/uploadLimits.js — the platform rejects bigger bodies anyway).
// The client `accept` lists only filter the picker; this is the check.
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_REQUEST_BYTES,
  UPLOAD_TOO_LARGE_MESSAGE,
} from "@/lib/uploadLimits";

export { MAX_UPLOAD_BYTES };

/**
 * A 413 body for a request whose Content-Length is already over the limit —
 * checked before the body is read. Returns null when it may be read.
 */
export function tooLargeRequest(req) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_UPLOAD_REQUEST_BYTES) {
    return { error: "TOO_LARGE", message: UPLOAD_TOO_LARGE_MESSAGE, maxSize: "4MB" };
  }
  return null;
}

/** Thai text for a checkUpload() error code. */
export function uploadErrorText(code) {
  if (code === "TOO_LARGE") return UPLOAD_TOO_LARGE_MESSAGE;
  if (code === "INVALID_TYPE") return "รองรับเฉพาะรูปภาพ (JPG, PNG, GIF, WEBP) และ PDF";
  return "ไม่พบไฟล์";
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;
const PDF_EXT = /\.pdf$/i;

/**
 * @returns {{ ok: true, kind: "image" | "pdf" } | { ok: false, status: number, error: string }}
 */
export function checkUpload(file) {
  if (!file || typeof file === "string") return { ok: false, status: 400, error: "NO_FILE" };
  const name = file.name || "";
  const type = (file.type || "").toLowerCase();

  let kind = null;
  if (IMAGE_TYPES.has(type) && IMAGE_EXT.test(name)) kind = "image";
  else if (type === "application/pdf" && PDF_EXT.test(name)) kind = "pdf";
  if (!kind) return { ok: false, status: 400, error: "INVALID_TYPE" };

  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, status: 413, error: "TOO_LARGE" };
  return { ok: true, kind };
}
