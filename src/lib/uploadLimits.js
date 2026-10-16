/**
 * Upload size limit — shared by the server checks (lib/server/uploadRules.js,
 * POST /api/employees photo) and the browser (lib/client/resizeImage.js).
 * Pure — safe in the browser.
 *
 * Vercel functions reject request bodies over ~4.5 MB before our code runs
 * (a raw 413), so every file must fit in 4 MB; images are resized in the
 * browser first.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const UPLOAD_TOO_LARGE_MESSAGE = "ไฟล์ใหญ่เกินไป (สูงสุด 4 MB) กรุณาเลือกไฟล์ที่เล็กกว่านี้";

/** Room for the multipart envelope and form fields around the file. */
export const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BYTES + 256 * 1024;
