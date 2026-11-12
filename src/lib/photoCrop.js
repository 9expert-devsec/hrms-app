/**
 * The frame a person chose for their profile photo. Pure — browser-safe.
 *
 * Stored on the Employee as `photoCrop: { x, y, width, height }`, each a
 * fraction (0–1) of the ORIGINAL image's width / height; the original image
 * is kept as uploaded. No crop stored → every view behaves as before.
 */

const EPS = 0.0005;
const MIN_SIDE = 0.01;
const round4 = (n) => Math.round(n * 10000) / 10000;

const KEYS = ["x", "y", "width", "height"];

/** A crop sent by a client: exactly the four keys, a usable frame. → clean crop or null. */
export function parsePhotoCropInput(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  if (Object.keys(v).some((k) => !KEYS.includes(k))) return null;
  return normalizePhotoCrop(v);
}

/** A clean { x, y, width, height } (4 decimals), or null when `v` is not a usable crop. */
export function normalizePhotoCrop(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const n = KEYS.map((k) => v[k]);
  if (n.some((x) => typeof x !== "number" || !Number.isFinite(x))) return null;
  let [x, y, width, height] = n;
  if (x < -EPS || y < -EPS || width < MIN_SIDE || height < MIN_SIDE) return null;
  if (x + width > 1 + EPS || y + height > 1 + EPS) return null;
  x = Math.max(0, x);
  y = Math.max(0, y);
  width = Math.min(width, 1 - x);
  height = Math.min(height, 1 - y);
  return { x: round4(x), y: round4(y), width: round4(width), height: round4(height) };
}

/** The crop as a frame for the cropper (react-easy-crop percentages, 0–100). */
export function cropToPercentages(crop) {
  const c = normalizePhotoCrop(crop);
  return c ? { x: c.x * 100, y: c.y * 100, width: c.width * 100, height: c.height * 100 } : undefined;
}

/** react-easy-crop's croppedArea (percentages, 0–100) as a stored crop. */
export function cropFromPercentages(area) {
  if (!area) return null;
  return normalizePhotoCrop({ x: area.x / 100, y: area.y / 100, width: area.width / 100, height: area.height / 100 });
}

/**
 * Cloudinary crop step for the chosen frame. Values carry a decimal point, so
 * Cloudinary reads them as fractions of the original ("w_1.0000" = full width).
 */
export function cloudinaryCropStep(crop) {
  const c = normalizePhotoCrop(crop);
  if (!c) return null;
  const f = (n) => n.toFixed(4);
  return `c_crop,x_${f(c.x)},y_${f(c.y)},w_${f(c.width)},h_${f(c.height)}`;
}

/**
 * CSS for an <img> inside a positioned, overflow-hidden box of any size, so
 * the box shows exactly the chosen frame (used for non-Cloudinary images and
 * for the live preview while choosing).
 */
export function cssCropStyle(crop) {
  const c = normalizePhotoCrop(crop);
  if (!c) return null;
  return {
    position: "absolute",
    maxWidth: "none",
    width: `${100 / c.width}%`,
    height: `${100 / c.height}%`,
    left: `${(-100 * c.x) / c.width}%`,
    top: `${(-100 * c.y) / c.height}%`,
  };
}
