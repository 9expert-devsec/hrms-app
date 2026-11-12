"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { ZoomIn, ZoomOut } from "lucide-react";
import { cropFromPercentages, cropToPercentages, cssCropStyle } from "@/lib/photoCrop";

const NAVY = "#0D1B2A";
const SLATE = "#5E6A7E";
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005CFF]";
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;
// Arrow keys move the photo 8 px (Shift: finer); the library's default 1 px is too slow.
const KEYBOARD_STEP = 8;

/** Live round preview of the frame being chosen, `size` px. */
function Preview({ src, area, size }) {
  const style = area ? cssCropStyle(cropFromPercentages(area)) : null;
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size, background: "#DCE6F7", boxShadow: "0 0 0 2px #FFFFFF, 0 0 0 3px #D6E0F0" }}
      data-testid="crop-preview"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- preview of an unsaved frame */}
      {style && <img src={src} alt="" style={{ ...style, display: "block" }} />}
    </span>
  );
}

/**
 * "ปรับกรอบรูป": choose the square frame of a profile photo. Drag (or arrow
 * keys) to move, the slider / pinch / + − to zoom; a round preview shows the
 * avatar as it will look. `initialCrop` (fractions) reopens a saved frame.
 * onApply(crop) gets fractions of the original image (lib/photoCrop.js).
 */
export default function PhotoCropDialog({ src, initialCrop = null, onApply, onCancel }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState(null);
  const [initial] = useState(() => cropToPercentages(initialCrop));
  const boxRef = useRef(null);
  const dialogRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const zoomTo = (z) => setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100)));

  // Rendered on document.body (portal): an ancestor with a transform — e.g. a
  // card lifted on :hover by globals.css — would otherwise become the
  // containing block of this fixed overlay and trap it under later content.
  useEffect(() => setMounted(true), []);

  // While open: the page behind does not scroll (window and the app shell's
  // <main>); on close, focus returns to the control that opened the dialog.
  useEffect(() => {
    const opener = document.activeElement;
    const main = document.querySelector("main main");
    const prev = { body: document.body.style.overflow, main: main?.style.overflowY };
    document.body.style.overflow = "hidden";
    if (main) main.style.overflowY = "hidden";
    return () => {
      document.body.style.overflow = prev.body;
      if (main) main.style.overflowY = prev.main;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  // Focus the frame (arrow keys move it) once the image is in.
  useEffect(() => {
    if (!mounted) return;
    const t = setInterval(() => {
      const el = boxRef.current?.querySelector('[data-testid="cropper"]');
      if (el) {
        el.focus({ preventScroll: true });
        clearInterval(t);
      }
    }, 50);
    return () => clearInterval(t);
  }, [mounted]);

  /** Tab / Shift+Tab stay inside the dialog. */
  function trapTab(e) {
    const items = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]') || [])];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const inside = dialogRef.current.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }

  function onKeyDown(e) {
    if (e.key === "Tab") {
      trapTab(e);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomTo(zoom + ZOOM_STEP);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomTo(zoom - ZOOM_STEP);
    }
  }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto overscroll-contain p-4" style={{ background: "rgba(13,27,42,0.55)" }} onKeyDown={onKeyDown}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-crop-title"
        aria-describedby="photo-crop-help"
        className="w-full max-w-[520px] rounded-2xl bg-white p-5 shadow-xl"
        data-testid="photo-crop"
      >
        <h2 id="photo-crop-title" className="text-[18px] font-bold" style={{ color: NAVY }}>ปรับกรอบรูป</h2>
        <p id="photo-crop-help" className="mt-1 text-[13px]" style={{ color: SLATE }}>
          ลากเพื่อเลื่อนรูป ใช้แถบซูมหรือจีบนิ้วเพื่อขยาย — แป้นพิมพ์: ลูกศรเลื่อน, + / − ซูม
        </p>

        <div ref={boxRef} className="relative mt-4 h-[300px] overflow-hidden rounded-xl sm:h-[340px]" style={{ background: NAVY }}>
          <Cropper
            image={src}
            crop={pos}
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            aspect={1}
            showGrid={false}
            keyboardStep={KEYBOARD_STEP}
            initialCroppedAreaPercentages={initial}
            onCropChange={setPos}
            onZoomChange={zoomTo}
            onCropComplete={(a) => setArea(a)}
            cropperProps={{ "aria-label": "กรอบรูป — ใช้ปุ่มลูกศรเพื่อเลื่อน" }}
            mediaProps={{ alt: "" }}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={() => zoomTo(zoom - ZOOM_STEP)} className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${FOCUS}`} style={{ border: "1px solid #D6E0F0", color: NAVY }} aria-label="ซูมออก">
            <ZoomOut size={18} aria-hidden />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => zoomTo(Number(e.target.value))}
            aria-label="ซูม"
            className="h-11 min-w-0 flex-1 accent-[#005CFF]"
            data-testid="crop-zoom"
          />
          <button type="button" onClick={() => zoomTo(zoom + ZOOM_STEP)} className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${FOCUS}`} style={{ border: "1px solid #D6E0F0", color: NAVY }} aria-label="ซูมเข้า">
            <ZoomIn size={18} aria-hidden />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Preview src={src} area={area} size={40} />
            <Preview src={src} area={area} size={72} />
            <span className="text-[12px]" style={{ color: SLATE }}>ตัวอย่างรูปโปรไฟล์</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className={`inline-flex min-h-[44px] items-center rounded-xl px-4 text-[14px] font-medium ${FOCUS}`} style={{ border: "1px solid #D6E0F0", color: NAVY }} data-testid="crop-cancel">
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => onApply(cropFromPercentages(area))}
              disabled={!area}
              className={`inline-flex min-h-[44px] items-center rounded-xl px-4 text-[14px] font-semibold text-white disabled:opacity-50 ${FOCUS}`}
              style={{ background: "#005CFF" }}
              data-testid="crop-apply"
            >
              ใช้รูปนี้
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
