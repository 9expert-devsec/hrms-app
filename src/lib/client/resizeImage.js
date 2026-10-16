/**
 * Browser-only: shrink an image before it is uploaded, so the request stays
 * under the platform body limit (lib/uploadLimits.js). Every image upload
 * goes through prepareUpload().
 *
 * - longest side ≤ MAX_IMAGE_SIDE px, never upscaled;
 * - EXIF orientation applied (phone photos are not sideways);
 * - output WebP (quality IMAGE_QUALITY), else JPEG when the browser cannot
 *   encode WebP — but an image with transparency is never JPEG: WebP with
 *   alpha, else PNG;
 * - GIF, SVG, images the browser cannot decode, and non-images pass through.
 */
import { MAX_UPLOAD_BYTES, UPLOAD_TOO_LARGE_MESSAGE } from "@/lib/uploadLimits";

export const MAX_IMAGE_SIDE = 1024;
export const IMAGE_QUALITY = 0.85;

const PASS_THROUGH_TYPES = new Set(["image/gif", "image/svg+xml"]);
const MAY_HAVE_ALPHA = new Set(["image/png", "image/webp"]);
const EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/** Thrown when a file is still over the limit; `message` is Thai, for the user. */
export class UploadTooLargeError extends Error {
  constructor() {
    super(UPLOAD_TOO_LARGE_MESSAGE);
    this.name = "UploadTooLargeError";
  }
}

/** Target size: longest side ≤ max, aspect kept, never upscaled. Pure. */
export function fitWithin(width, height, max = MAX_IMAGE_SIDE) {
  const longest = Math.max(width, height);
  if (!(longest > max)) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The Thai message for a failed upload response (a raw platform 413 included). */
export function uploadErrorMessage(res, body) {
  if (res?.status === 413) return UPLOAD_TOO_LARGE_MESSAGE;
  return body?.message || body?.error || "อัปโหลดไม่สำเร็จ";
}

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through to <img>, which applies EXIF orientation by default
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hasAlpha(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function renamed(name, type) {
  const base = (name || "image").replace(/\.[^.]*$/, "") || "image";
  return `${base}.${EXT[type]}`;
}

/**
 * Resize an image file for upload. Returns a File (the original when it is
 * passed through, or when re-encoding would not make it smaller).
 */
export async function resizeImage(file) {
  const type = (file?.type || "").toLowerCase();
  if (!type.startsWith("image/") || PASS_THROUGH_TYPES.has(type)) return file;

  let source;
  try {
    source = await decode(file);
  } catch {
    return file; // e.g. HEIC on a browser that can't read it
  }
  const srcW = source.width || source.naturalWidth;
  const srcH = source.height || source.naturalHeight;
  const { width, height } = fitWithin(srcW, srcH);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: MAY_HAVE_ALPHA.has(type) });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  source.close?.();

  const transparent = MAY_HAVE_ALPHA.has(type) && hasAlpha(ctx, width, height);

  // A browser that can't encode WebP hands back a PNG instead.
  let blob = await toBlob(canvas, "image/webp", IMAGE_QUALITY);
  if (!blob || blob.type !== "image/webp") {
    blob = transparent ? await toBlob(canvas, "image/png") : await toBlob(canvas, "image/jpeg", IMAGE_QUALITY);
  }
  if (!blob) return file;

  const resized = width !== srcW || height !== srcH;
  if (!resized && blob.size >= file.size) return file;

  return new File([blob], renamed(file.name, blob.type), { type: blob.type, lastModified: Date.now() });
}

/**
 * The one entry point for uploads: resize images, then refuse anything still
 * over MAX_UPLOAD_BYTES (throws UploadTooLargeError with the Thai message).
 */
export async function prepareUpload(file) {
  const out = await resizeImage(file);
  if (out.size > MAX_UPLOAD_BYTES) throw new UploadTooLargeError();
  return out;
}
