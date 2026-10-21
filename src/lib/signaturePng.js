/**
 * The one accepted signature format, checked on every API that stores a
 * signature (profile store, leave request, leave approval): a
 * `data:image/png;base64` value whose bytes are a PNG (signature + IHDR) of
 * exactly 400×160 px, at most 300 KB. Drawn and uploaded signatures are both
 * produced in this format in the browser (components/SignatureInput.jsx).
 * Pure — no dependencies; the IHDR is read directly.
 */
export const SIGNATURE_WIDTH = 400;
export const SIGNATURE_HEIGHT = 160;
export const SIGNATURE_MAX_BYTES = 300 * 1024;
export const SIGNATURE_FORMAT_MESSAGE = "ลายเซ็นต้องเป็นรูป PNG ขนาด 400×160 พิกเซล และไม่เกิน 300 KB";

const PNG_DATA_URL_RE = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** null when `value` is an acceptable signature, else the Thai message to return with a 400. */
export function signaturePngError(value) {
  const m = typeof value === "string" ? value.match(PNG_DATA_URL_RE) : null;
  if (!m) return SIGNATURE_FORMAT_MESSAGE;
  // Decoded size from the base64 length, before decoding anything large.
  const pad = m[1].endsWith("==") ? 2 : m[1].endsWith("=") ? 1 : 0;
  if ((m[1].length * 3) / 4 - pad > SIGNATURE_MAX_BYTES) return SIGNATURE_FORMAT_MESSAGE;
  const bytes = Buffer.from(m[1], "base64");
  if (bytes.length > SIGNATURE_MAX_BYTES || bytes.length < 24) return SIGNATURE_FORMAT_MESSAGE;
  if (PNG_MAGIC.some((b, i) => bytes[i] !== b)) return SIGNATURE_FORMAT_MESSAGE;
  // First chunk must be IHDR: length(4) "IHDR"(4) width(4) height(4).
  if (bytes.toString("latin1", 12, 16) !== "IHDR") return SIGNATURE_FORMAT_MESSAGE;
  if (bytes.readUInt32BE(16) !== SIGNATURE_WIDTH || bytes.readUInt32BE(20) !== SIGNATURE_HEIGHT) return SIGNATURE_FORMAT_MESSAGE;
  return null;
}
