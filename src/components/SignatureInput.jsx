"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUp, Loader2, PenLine } from "lucide-react";
import SignaturePad from "./SignaturePad";
import {
  SIGNATURE_FILE_MAX_BYTES,
  SIGNATURE_FILE_MESSAGE,
  SIGNATURE_NO_INK_MESSAGE,
  SIGNATURE_OUT_H,
  SIGNATURE_OUT_W,
  SIGNATURE_SOURCE_MAX,
  SIGNATURE_STRENGTH_DEFAULT,
  cleanSignatureImage,
  sniffImageType,
} from "@/lib/signatureCleanup";

const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const SLATE = "#5E6A7E";
const MAX_PNG_CHARS = Math.floor((300 * 1024 * 4) / 3) + 30; // 300 KB decoded (lib/signaturePng.js)

/** Any signature image (the pad's devicePixelRatio-sized PNG, or a cleaned upload) → the stored 400×160 PNG data URL. */
export function shrinkSignature(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SIGNATURE_OUT_W;
      canvas.height = SIGNATURE_OUT_H;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, SIGNATURE_OUT_W, SIGNATURE_OUT_H);
      ctx.drawImage(img, 0, 0, SIGNATURE_OUT_W, SIGNATURE_OUT_H);
      const out = canvas.toDataURL("image/png");
      if (out.length > MAX_PNG_CHARS) reject(new Error("ลายเซ็นมีขนาดใหญ่เกิน 300 KB กรุณาลองใหม่"));
      else resolve(out);
    };
    img.onerror = () => reject(new Error("อ่านลายเซ็นไม่ได้"));
    img.src = dataUrl;
  });
}

/**
 * Decode an uploaded file to ImageData, never trusting its name: the first
 * bytes must say PNG / JPEG / WebP and the browser must decode it. Phone
 * rotation (EXIF) is applied; the longest side is brought down to 1600 px.
 */
async function loadSignatureFile(file) {
  if (!file || file.size > SIGNATURE_FILE_MAX_BYTES) throw new Error(SIGNATURE_FILE_MESSAGE);
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!sniffImageType(head)) throw new Error(SIGNATURE_FILE_MESSAGE);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(SIGNATURE_FILE_MESSAGE);
  }
  const scale = Math.min(1, SIGNATURE_SOURCE_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h); // transparency kept: the clean-up composites on white
  bitmap.close?.();
  return ctx.getImageData(0, 0, w, h);
}

/** Cleaned 400×160 RGBA → PNG data URL (a fresh encode: no EXIF or other metadata survives). */
function toPngDataUrl({ data, width, height }) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(new ImageData(data, width, height), 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * "อัปโหลดไฟล์": pick or drop a PNG / JPEG / WebP (≤ 5 MB); it is cleaned in
 * the browser (background removed, ink cropped, recoloured, fitted to
 * 400×160) and previewed with a "ความเข้ม" slider. Only the cleaned PNG ever
 * leaves the browser — the file itself is never uploaded or stored.
 */
function SignatureUpload({ confirmLabel, onSave, onClear }) {
  const inputRef = useRef(null);
  const [source, setSource] = useState(null); // ImageData of the decoded file
  const [fileName, setFileName] = useState("");
  const [strength, setStrength] = useState(SIGNATURE_STRENGTH_DEFAULT);
  const [result, setResult] = useState(null); // PNG data URL | "no-ink" | null
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Re-run the clean-up whenever the file or the slider changes (slider debounced).
  useEffect(() => {
    if (!source) return undefined;
    const t = setTimeout(() => {
      const r = cleanSignatureImage(source, { strength });
      setResult(r.ok ? toPngDataUrl(r.image) : "no-ink");
    }, 120);
    return () => clearTimeout(t);
  }, [source, strength]);

  const unconfirm = () => {
    if (confirmed) {
      setConfirmed(false);
      onClear?.();
    }
  };

  const takeFile = async (file) => {
    unconfirm();
    setError("");
    setResult(null);
    setSource(null);
    setFileName(file?.name || "");
    if (!file) return;
    setLoading(true);
    try {
      setSource(await loadSignatureFile(file));
      setStrength(SIGNATURE_STRENGTH_DEFAULT);
    } catch (e) {
      setError(e.message || SIGNATURE_FILE_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  const pickAgain = () => {
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.click();
  };

  const ready = typeof result === "string" && result.startsWith("data:");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="sig-upload">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={(e) => takeFile(e.target.files?.[0])}
        data-testid="sig-upload-input"
      />
      {!source && (
        <button
          type="button"
          onClick={pickAgain}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            takeFile(e.dataTransfer.files?.[0]);
          }}
          style={{
            width: SIGNATURE_OUT_W,
            maxWidth: "100%",
            minHeight: SIGNATURE_OUT_H,
            border: `2px dashed ${dragging ? BLUE : "rgba(0,92,255,0.35)"}`,
            borderRadius: 12,
            background: dragging ? "rgba(0,92,255,0.06)" : "#F8FAFD",
            color: NAVY,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: 16,
            cursor: "pointer",
            textAlign: "center",
          }}
          data-testid="sig-upload-drop"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <ImageUp size={22} color={BLUE} />}
          <span style={{ fontSize: 14, fontWeight: 600 }}>{loading ? "กำลังอ่านไฟล์…" : "เลือกไฟล์ หรือลากรูปลายเซ็นมาวางที่นี่"}</span>
          <span style={{ fontSize: 12, color: SLATE }}>PNG, JPG หรือ WebP ไม่เกิน 5 MB · ถ่ายรูปลายเซ็นบนกระดาษสีขาวได้</span>
        </button>
      )}

      {source && (
        <>
          <div
            style={{
              width: SIGNATURE_OUT_W,
              maxWidth: "100%",
              aspectRatio: `${SIGNATURE_OUT_W} / ${SIGNATURE_OUT_H}`,
              border: "1px solid rgba(0,92,255,0.25)",
              borderRadius: 8,
              background: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {ready ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result} alt="ตัวอย่างลายเซ็น" width={SIGNATURE_OUT_W} height={SIGNATURE_OUT_H} style={{ display: "block", width: "100%", height: "auto" }} data-testid="sig-upload-preview" />
            ) : result === "no-ink" ? (
              <span style={{ color: "#B42318", fontSize: 13, padding: 12, textAlign: "center" }} data-testid="sig-upload-noink">
                {SIGNATURE_NO_INK_MESSAGE}
              </span>
            ) : (
              <Loader2 size={18} className="animate-spin" color={SLATE} />
            )}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, color: NAVY, fontSize: 13, maxWidth: SIGNATURE_OUT_W }}>
            <span style={{ whiteSpace: "nowrap" }}>ความเข้ม</span>
            <input
              type="range"
              min={1}
              max={100}
              value={strength}
              onChange={(e) => {
                unconfirm();
                setStrength(Number(e.target.value));
              }}
              style={{ flex: 1 }}
              data-testid="sig-upload-strength"
            />
            <span style={{ width: 28, textAlign: "right", color: SLATE }}>{strength}</span>
          </label>
          <span style={{ fontSize: 12, color: SLATE }}>เลื่อนไปทางขวาเพื่อเก็บเส้นที่จางลง ไปทางซ้ายเพื่อลบพื้นหลังมากขึ้น{fileName ? ` · ${fileName}` : ""}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={pickAgain}
              style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, borderRadius: 10, border: "1px solid rgba(0,92,255,0.25)", background: "#FFFFFF", color: NAVY, cursor: "pointer" }}
            >
              เลือกไฟล์ใหม่
            </button>
            <button
              type="button"
              disabled={!ready || confirmed}
              onClick={() => {
                setConfirmed(true);
                onSave?.(result);
              }}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 10,
                border: "none",
                background: !ready ? "#C7D2E3" : "linear-gradient(135deg, #005CFF, #2486FF)",
                color: "#FFFFFF",
                cursor: ready && !confirmed ? "pointer" : "not-allowed",
                opacity: confirmed ? 0.7 : 1,
              }}
              data-testid="sig-upload-confirm"
            >
              {confirmed ? "✓ ใช้ลายเซ็นนี้แล้ว" : confirmLabel}
            </button>
          </div>
        </>
      )}

      {error && (
        <span role="alert" style={{ color: "#B42318", fontSize: 13 }} data-testid="sig-upload-error">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * The one signature-capture block: "วาดลายเซ็น" (the drawing pad, unchanged)
 * or "อัปโหลดไฟล์" (a cleaned-up file). Either way onSave receives the same
 * stored format — a 400×160 PNG data URL — so nothing downstream can tell
 * them apart. Switching tabs clears the current choice (onClear).
 */
export default function SignatureInput({ label, hint, clearLabel, confirmLabel = "ใช้ลายเซ็นนี้", resignLabel, onSave, onClear }) {
  const [tab, setTab] = useState("draw");
  const [error, setError] = useState("");

  const switchTo = (next) => {
    if (next === tab) return;
    setTab(next);
    setError("");
    onClear?.();
  };
  const tabBtn = (active) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 10,
    border: `1px solid ${active ? BLUE : "rgba(0,92,255,0.25)"}`,
    background: active ? "rgba(0,92,255,0.08)" : "#FFFFFF",
    color: active ? BLUE : NAVY,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="signature-input">
      <div role="tablist" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" role="tab" aria-selected={tab === "draw"} onClick={() => switchTo("draw")} style={tabBtn(tab === "draw")} data-testid="sig-tab-draw">
          <PenLine size={14} /> วาดลายเซ็น
        </button>
        <button type="button" role="tab" aria-selected={tab === "upload"} onClick={() => switchTo("upload")} style={tabBtn(tab === "upload")} data-testid="sig-tab-upload">
          <ImageUp size={14} /> อัปโหลดไฟล์
        </button>
      </div>
      {tab === "draw" ? (
        <SignaturePad
          label={label}
          hint={hint}
          clearLabel={clearLabel}
          confirmLabel={confirmLabel}
          resignLabel={resignLabel}
          onSave={async (raw) => {
            setError("");
            try {
              onSave?.(await shrinkSignature(raw));
            } catch (e) {
              setError(e.message);
            }
          }}
          onClear={onClear}
        />
      ) : (
        <SignatureUpload confirmLabel={confirmLabel} onSave={onSave} onClear={onClear} />
      )}
      {error && <span style={{ color: "#B42318", fontSize: 13 }}>{error}</span>}
    </div>
  );
}
