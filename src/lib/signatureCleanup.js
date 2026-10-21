/**
 * Uploaded-signature clean-up — the pure part (no DOM, no Node APIs), so the
 * browser runs it on a canvas's ImageData and tests can run it anywhere.
 * components/SignatureInput.jsx decodes the file (createImageBitmap, phone
 * rotation applied, longest side ≤ 1600 px) and encodes the result as PNG.
 *
 * The output is exactly what the drawing pad produces: 400×160, opaque white
 * background, ink #0D1B2A, the ink centred and scaled to fit with ~8 px
 * padding (aspect kept). The paper is estimated from the border pixels, and
 * a coarse local background map absorbs uneven light (photos, grey scans);
 * transparent PNGs are composited on white first.
 */

export const SIGNATURE_OUT_W = 400;
export const SIGNATURE_OUT_H = 160;
export const SIGNATURE_PADDING = 8;
export const SIGNATURE_INK = [13, 27, 42]; // #0D1B2A, the pad's ink
export const SIGNATURE_SOURCE_MAX = 1600; // longest side the browser decodes to
export const SIGNATURE_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const SIGNATURE_STRENGTH_DEFAULT = 50; // "ความเข้ม" 1–100: higher keeps fainter strokes

export const SIGNATURE_FILE_MESSAGE = "รองรับเฉพาะไฟล์ PNG, JPG หรือ WebP ขนาดไม่เกิน 5 MB";
export const SIGNATURE_NO_INK_MESSAGE = "ไม่พบลายเซ็นในรูป ลองรูปที่พื้นหลังสว่างและเส้นชัดกว่านี้";

const RAMP = 40; // darkness over the threshold that ramps alpha 0 → 1 (keeps edges smooth)
const MASK_ALPHA = 0.25; // pixels at least this opaque count as ink for components / bounding box
const MAX_INK_SHARE = 0.45; // more "ink" than this is a dark photo, not a signature

/** "png" | "jpeg" | "webp" from the file's first bytes, or null (SVG, PDF, HEIC, text… are rejected). */
export function sniffImageType(head) {
  const b = head;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}

function median(values) {
  const a = Float32Array.from(values).sort();
  return a.length ? a[a.length >> 1] : 255;
}

/** Luminance of each pixel composited on white. */
function luminance({ data, width, height }) {
  const L = new Float32Array(width * height);
  for (let i = 0, n = 0; n < L.length; i += 4, n += 1) {
    const a = data[i + 3] / 255;
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    L[n] = y * a + 255 * (1 - a);
  }
  return L;
}

/** Indexes of the border band (sampled on big images) and the paper luminance there. */
function paperStats(L, width, height) {
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.03));
  const border = [];
  const step = Math.max(1, Math.round((width * height) / 200000));
  for (let y = 0; y < height; y += 1) {
    const edgeRow = y < band || y >= height - band;
    for (let x = 0; x < width; x += edgeRow ? step : 1) {
      if (!edgeRow && x >= band && x < width - band) x = width - band;
      border.push(y * width + x);
    }
  }
  return { paper: median(border.map((p) => L[p])), border };
}

/**
 * Darkness the paper itself reaches (grain, JPEG noise): measured on the
 * border AFTER removing the local background, so uneven light is not noise.
 */
function noiseFloor(L, bg, border) {
  const d = border.map((p) => bg[p] - L[p]);
  const med = median(d);
  const sigma = 1.4826 * median(d.map((v) => Math.abs(v - med)));
  return med + 3 * sigma + 4;
}

/**
 * Local background luminance (bright percentile per block, dilated so ink-heavy
 * blocks borrow from neighbours, then bilinear), never darker than the paper
 * estimate allows for gentle shading.
 */
function backgroundMap(L, width, height, paper) {
  const B = Math.max(8, Math.round(Math.min(width, height) / 12));
  const gw = Math.ceil(width / B);
  const gh = Math.ceil(height / B);
  const grid = new Float32Array(gw * gh);
  const hist = new Uint32Array(256);
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      hist.fill(0);
      let count = 0;
      for (let y = gy * B; y < Math.min(height, (gy + 1) * B); y += 1) {
        for (let x = gx * B; x < Math.min(width, (gx + 1) * B); x += 1) {
          hist[Math.min(255, Math.max(0, L[y * width + x] | 0))] += 1;
          count += 1;
        }
      }
      let need = count * 0.1; // 90th percentile from the bright end
      let v = 255;
      for (; v > 0; v -= 1) {
        need -= hist[v];
        if (need <= 0) break;
      }
      grid[gy * gw + gx] = v;
    }
  }
  const dil = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const yy = gy + dy;
          const xx = gx + dx;
          if (yy >= 0 && yy < gh && xx >= 0 && xx < gw) m = Math.max(m, grid[yy * gw + xx]);
        }
      }
      dil[gy * gw + gx] = Math.max(m, paper - 60);
    }
  }
  const bg = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / B - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(gh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < width; x += 1) {
      const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / B - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(gw - 1, x0 + 1);
      const tx = fx - x0;
      const top = dil[y0 * gw + x0] * (1 - tx) + dil[y0 * gw + x1] * tx;
      const bot = dil[y1 * gw + x0] * (1 - tx) + dil[y1 * gw + x1] * tx;
      bg[y * width + x] = top * (1 - ty) + bot * ty;
    }
  }
  return bg;
}

/** Drop specks: 8-connected components of the ink mask smaller than a share of the largest. */
function removeSpecks(alpha, width, height) {
  const n = width * height;
  const label = new Int32Array(n).fill(-1);
  const sizes = [];
  const stack = new Int32Array(n);
  for (let p = 0; p < n; p += 1) {
    if (label[p] !== -1 || alpha[p] < MASK_ALPHA) continue;
    const id = sizes.length;
    let top = 0;
    let size = 0;
    stack[top++] = p;
    label[p] = id;
    while (top) {
      const q = stack[--top];
      size += 1;
      const qx = q % width;
      const qy = (q - qx) / width;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = qy + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = qx + dx;
          if (xx < 0 || xx >= width) continue;
          const r = yy * width + xx;
          if (label[r] === -1 && alpha[r] >= MASK_ALPHA) {
            label[r] = id;
            stack[top++] = r;
          }
        }
      }
    }
    sizes.push(size);
  }
  if (!sizes.length) {
    alpha.fill(0);
    return 0;
  }
  const largest = Math.max(...sizes);
  const minSize = Math.min(40, Math.max(8, largest * 0.005));
  const keptAt = (p) => label[p] !== -1 && sizes[label[p]] >= minSize;
  let kept = 0;
  for (let p = 0; p < n; p += 1) {
    if (alpha[p] <= 0) continue;
    if (label[p] !== -1) {
      if (keptAt(p)) kept += 1;
      else alpha[p] = 0;
      continue;
    }
    // A faint (anti-aliased) pixel stays only where it touches kept ink.
    const px = p % width;
    const py = (p - px) / width;
    let touches = false;
    for (let dy = -1; dy <= 1 && !touches; dy += 1) {
      const yy = py + dy;
      if (yy < 0 || yy >= height) continue;
      for (let dx = -1; dx <= 1; dx += 1) {
        const xx = px + dx;
        if (xx >= 0 && xx < width && keptAt(yy * width + xx)) {
          touches = true;
          break;
        }
      }
    }
    if (!touches) alpha[p] = 0;
  }
  return kept;
}

/**
 * Clean an image: { data, width, height } (RGBA) → { ok: true, image } with a
 * 400×160 RGBA image, or { ok: false, reason: "no-ink" }.
 */
export function cleanSignatureImage(src, { strength = SIGNATURE_STRENGTH_DEFAULT } = {}) {
  const { width, height } = src;
  const L = luminance(src);
  const { paper, border } = paperStats(L, width, height);
  const bg = backgroundMap(L, width, height, paper);
  const s = Math.min(100, Math.max(1, strength));
  const thr = Math.max(noiseFloor(L, bg, border), 70 - (58 * s) / 100); // s 1 → ~70, s 50 → 41, s 100 → 12 (never below the paper's noise)
  const alpha = new Float32Array(width * height);
  for (let p = 0; p < alpha.length; p += 1) {
    const d = bg[p] - L[p];
    alpha[p] = d <= thr ? 0 : Math.min(1, (d - thr) / RAMP);
  }
  const kept = removeSpecks(alpha, width, height);
  const minInk = Math.max(20, width * height * 0.0002);
  if (kept < minInk || kept > width * height * MAX_INK_SHARE) return { ok: false, reason: "no-ink" };

  // Bounding box of the kept ink, plus a small margin.
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] >= MASK_ALPHA) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { ok: false, reason: "no-ink" };
  const margin = Math.max(2, Math.round(Math.max(x1 - x0, y1 - y0) * 0.02));
  x0 = Math.max(0, x0 - margin);
  y0 = Math.max(0, y0 - margin);
  x1 = Math.min(width - 1, x1 + margin);
  y1 = Math.min(height - 1, y1 + margin);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;

  // Fit into the padded output box, centred; area-average when shrinking, bilinear when enlarging.
  const W = SIGNATURE_OUT_W;
  const H = SIGNATURE_OUT_H;
  const scale = Math.min((W - 2 * SIGNATURE_PADDING) / cw, (H - 2 * SIGNATURE_PADDING) / ch);
  const dw = cw * scale;
  const dh = ch * scale;
  const ox = (W - dw) / 2;
  const oy = (H - dh) / 2;
  const at = (x, y) => alpha[(y0 + Math.min(ch - 1, Math.max(0, y))) * width + x0 + Math.min(cw - 1, Math.max(0, x))];
  const out = new Uint8ClampedArray(W * H * 4);
  const [ir, ig, ib] = SIGNATURE_INK;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      let a = 0;
      const sx0 = (x - ox) / scale;
      const sy0 = (y - oy) / scale;
      const sx1 = (x + 1 - ox) / scale;
      const sy1 = (y + 1 - oy) / scale;
      if (sx1 > 0 && sy1 > 0 && sx0 < cw && sy0 < ch) {
        if (scale < 1) {
          let sum = 0;
          let cnt = 0;
          for (let yy = Math.max(0, Math.floor(sy0)); yy < Math.min(ch, Math.ceil(sy1)); yy += 1) {
            for (let xx = Math.max(0, Math.floor(sx0)); xx < Math.min(cw, Math.ceil(sx1)); xx += 1) {
              sum += at(xx, yy);
              cnt += 1;
            }
          }
          a = cnt ? sum / cnt : 0;
        } else {
          const fx = (x + 0.5 - ox) / scale - 0.5;
          const fy = (y + 0.5 - oy) / scale - 0.5;
          const xa = Math.floor(fx);
          const ya = Math.floor(fy);
          const tx = fx - xa;
          const ty = fy - ya;
          a = (at(xa, ya) * (1 - tx) + at(xa + 1, ya) * tx) * (1 - ty) + (at(xa, ya + 1) * (1 - tx) + at(xa + 1, ya + 1) * tx) * ty;
        }
      }
      const i = (y * W + x) * 4;
      out[i] = 255 + (ir - 255) * a;
      out[i + 1] = 255 + (ig - 255) * a;
      out[i + 2] = 255 + (ib - 255) * a;
      out[i + 3] = 255;
    }
  }
  return { ok: true, image: { data: out, width: W, height: H } };
}
