/**
 * Print-time signature handling for the off-site form (client only; the
 * stored signature is never changed). Stored signatures are opaque 400×160
 * canvas PNGs — white background, thin #0D1B2A strokes — so printed whole and
 * shrunk they float above the line and print pale grey. Here each <img
 * data-sig> is redrawn as: alpha from darkness (smooth anti-aliased edges),
 * ink solid black, cropped to the ink's bounding box + 1 px; then sized and
 * set ON its dotted line.
 */

const PX_PER_PT = 96 / 72;
const INK_FLOOR = 12; // darkness (0–255) below this is background → fully transparent
const INK_FULL = 150; // darkness at or above this is fully opaque ink
const INK_BOX_ALPHA = 32; // pixels at least this opaque define the ink's bounding box
const DIP_PT = 1; // the ink's bottom dips this far below the dot baseline, like a pen

// Largest box each kind may fill (aspect ratio kept).
const SIG_BOX = {
  member: { w: 80, h: 18 },
  approval: { w: 140, h: 34 },
};

/** A same-origin (untainted) URL for the image: data:/same-origin as is, anything else fetched as a blob. */
async function sameOriginSrc(src) {
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  if (new URL(src, window.location.href).origin === window.location.origin) return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`signature fetch ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

/** Redraw one signature as transparent-backed black ink cropped to its bounding box. Throws on failure. */
export async function prepareSignature(img) {
  const source = new Image();
  source.src = await sameOriginSrc(img.getAttribute("src"));
  await source.decode();
  const w = source.naturalWidth;
  const h = source.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // Judge darkness against white, whatever the stored background (opaque or not).
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, w, h);
  const p = image.data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0, n = 0; i < p.length; i += 4, n += 1) {
    const dark = 255 - (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]);
    const a = dark < INK_FLOOR ? 0 : Math.min(255, Math.round(((dark - INK_FLOOR) * 255) / (INK_FULL - INK_FLOOR)));
    p[i] = 0;
    p[i + 1] = 0;
    p[i + 2] = 0;
    p[i + 3] = a;
    if (a >= INK_BOX_ALPHA) {
      const x = n % w;
      const y = (n - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error("no ink");
  ctx.putImageData(image, 0, 0);
  x0 = Math.max(0, x0 - 1);
  y0 = Math.max(0, y0 - 1);
  x1 = Math.min(w - 1, x1 + 1);
  y1 = Math.min(h - 1, y1 + 1);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d").drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
  img.src = out.toDataURL("image/png");
  await img.decode();
  img.dataset.sigPrepared = "1";
}

/** Prepare every signature; one that fails keeps its original image (never a blank cell). */
export async function prepareSignatures() {
  const imgs = [...document.querySelectorAll("img[data-sig]")];
  await Promise.all(
    imgs.map((img) =>
      prepareSignature(img).catch(async () => {
        img.dataset.sigPrepared = "fallback";
        await img.decode().catch(() => {});
      })
    )
  );
}

/** Page y (px) of the text baseline inside `el` (a dotted line), via a zero-height inline-block probe. */
function baselineY(el) {
  const probe = document.createElement("span");
  probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
  el.appendChild(probe);
  const y = probe.getBoundingClientRect().top;
  probe.remove();
  return y;
}

/**
 * Size each signature to its box (aspect kept) and rest its ink on the dot
 * baseline of its line (DIP_PT below). Horizontal centring is the CSS's
 * (auto margins). Run after the layout is final (fit, compaction, leaders).
 */
export function placeSignatures() {
  for (const img of document.querySelectorAll("img[data-sig]")) {
    const box = SIG_BOX[img.dataset.sig];
    const holder = img.parentElement;
    const dots = holder?.querySelector(img.dataset.sig === "member" ? ".pf-dots" : ".pf-sign-dots");
    if (!box || !dots || !img.naturalWidth || !img.naturalHeight) continue;
    const scale = Math.min(box.w / img.naturalWidth, box.h / img.naturalHeight);
    const wPt = img.naturalWidth * scale;
    const hPt = img.naturalHeight * scale;
    img.style.width = `${wPt.toFixed(2)}pt`;
    img.style.height = `${hPt.toFixed(2)}pt`;
    img.style.maxWidth = "none";
    img.style.maxHeight = "none";
    const basePt = (baselineY(dots) - holder.getBoundingClientRect().top) / PX_PER_PT;
    img.style.top = `${(basePt + DIP_PT - hPt).toFixed(2)}pt`;
    img.style.bottom = "auto";
  }
}
