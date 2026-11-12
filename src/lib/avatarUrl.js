/**
 * Small/round avatar URLs. Pure — safe in the browser.
 *
 * Most new photos are tall portraits (half/full body), so a centred
 * object-cover crop shows the torso. For a Cloudinary image we ask Cloudinary
 * for a face-centred square instead (c_thumb + g_face), at 2× the rendered
 * size for retina screens. Anything else is returned unchanged; the Avatar
 * component anchors those to the top (object-position: top).
 *
 * Stored photoUrl values are never changed — this only builds a delivery URL.
 * A frame the person chose (Employee.photoCrop) replaces the face detection.
 */
import { cloudinaryCropStep } from "./photoCrop.js";

/** z_ below 1 zooms out around the face: head and shoulders, not just a face. */
export const AVATAR_FACE_ZOOM = 0.7;

const UPLOAD = "/image/upload/";
const CLOUDINARY_HOST = /^https?:\/\/res\.cloudinary\.com\//i;
const VERSION = /^v\d+$/;
// Cloudinary transformation parameter keys ("c_fill", "w_200", "e_sharpen:50"…).
const PARAM_KEYS = new Set([
  "a", "ac", "af", "ar", "b", "bo", "c", "co", "cs", "d", "dl", "dn", "dpr", "du", "e", "eo",
  "f", "fl", "fn", "fps", "g", "h", "ki", "l", "o", "p", "pg", "q", "r", "so", "sp", "t", "u",
  "vc", "vs", "w", "x", "y", "z",
]);
// Ours replaces these in an existing transformation (a second crop would stack).
const REPLACED = new Set(["c", "w", "h", "g", "z", "ar", "f", "q", "x", "y", "dpr"]);

const keyOf = (component) => component.slice(0, component.indexOf("_"));
const looksLikeTransformation = (seg) =>
  seg.split(",").every((c) => c.indexOf("_") > 0 && PARAM_KEYS.has(keyOf(c)));

/** A Cloudinary delivery URL we can add transformations to. */
export function isCloudinaryUrl(url) {
  return typeof url === "string" && CLOUDINARY_HOST.test(url) && url.includes(UPLOAD);
}

/**
 * `url` as a square of `sizePx` CSS pixels (delivered at 2×). With a chosen
 * frame (`crop`, lib/photoCrop.js) Cloudinary cuts exactly that frame from
 * the original; without one it is face-centred as before (c_thumb,g_face).
 * Non-Cloudinary, empty and data: URLs come back unchanged — the Avatar
 * component applies a crop to those with CSS.
 */
export function avatarUrl(url, sizePx, crop = null) {
  if (!url || typeof url !== "string" || !CLOUDINARY_HOST.test(url)) return url;
  const at = url.indexOf(UPLOAD);
  if (at < 0) return url;

  const head = url.slice(0, at + UPLOAD.length);
  const segments = url.slice(at + UPLOAD.length).split("/");

  // Leading transformation segments: everything before a v<n> version, or —
  // without a version — segments made only of known parameter keys (so a
  // folder such as "hr_photos" is not mistaken for one).
  let taken = segments.findIndex((s) => VERSION.test(s));
  if (taken < 0) {
    taken = 0;
    while (taken < segments.length - 1 && looksLikeTransformation(segments[taken])) taken++;
  }
  const kept = segments
    .splice(0, taken)
    .map((seg) => seg.split(",").filter((c) => !REPLACED.has(keyOf(c))).join(","))
    .filter(Boolean);

  const px = Math.max(1, Math.round((Number(sizePx) || 40) * 2));
  const frame = cloudinaryCropStep(crop);
  if (frame) {
    // The chosen frame is cut from the original first, then scaled.
    return head + [frame, ...kept, `c_fill,w_${px},h_${px},f_auto,q_auto`, ...segments].join("/");
  }
  const ours = `c_thumb,g_face,z_${AVATAR_FACE_ZOOM},w_${px},h_${px},f_auto,q_auto`;
  return head + [...kept, ours, ...segments].join("/");
}
