// src/lib/server/uploadRules.js
// Server-side file rule for every upload route: an image or a PDF, at most
// 10 MB. The client `accept` lists only filter the picker; this is the check.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

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
