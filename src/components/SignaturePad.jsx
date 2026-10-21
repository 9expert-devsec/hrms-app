"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Undo2, X } from "lucide-react";

/*
 * The drawing pad. Strokes are kept in a fixed 400×160 space (the stored
 * signature size), so the pad can be any size on screen — it fills its
 * container up to 600 px at 5:2 — and undo / resize / full-screen just
 * redraw. The image handed to onSave is always a fresh 400×160 PNG, white
 * background, 2-px #0D1B2A ink: the same as before, so storage and print
 * are unchanged.
 *
 * Input is Pointer Events only (finger, stylus, mouse): one pointer at a time
 * (a second finger or a palm is ignored), captured, and `touch-action: none`
 * so drawing never scrolls or zooms the page.
 */

const W = 400; // stored signature size (logical drawing space)
const H = 160;
const MAX_CSS_W = 600;
const INK = "#0D1B2A";
const LINE = 2; // logical px (= px in the stored 400×160 image)
const NARROW = "(max-width: 767px)"; // phones: offer "เซ็นเต็มจอ"
const TOUCH_BTN = 44; // minimum button height

/** Paint `strokes` (logical points) at `scale` CSS→device pixels per logical px. */
function paint(ctx, strokes, scale) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = LINE;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    if (!s.length) continue;
    if (s.length === 1) {
      ctx.beginPath();
      ctx.arc(s[0].x, s[0].y, LINE / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    // Quadratic curves between midpoints: smooth, passing near every sample.
    ctx.beginPath();
    ctx.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length - 1; i += 1) {
      const mx = (s[i].x + s[i + 1].x) / 2;
      const my = (s[i].y + s[i + 1].y) / 2;
      ctx.quadraticCurveTo(s[i].x, s[i].y, mx, my);
    }
    const last = s[s.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
}

/** The strokes as the stored 400×160 PNG data URL. */
function exportPng(strokes) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  paint(c.getContext("2d"), strokes, 1);
  return c.toDataURL("image/png");
}

/**
 * A canvas `cssWidth` wide (5:2) that draws `strokesRef.current` and appends
 * new strokes to it. `redrawKey` repaints after an outside change (undo,
 * clear); `onStroke(count)` reports each finished stroke.
 */
function DrawingSurface({ strokesRef, cssWidth, redrawKey, onStroke, testId, border = "1px solid rgba(0,92,255,0.20)" }) {
  const canvasRef = useRef(null);
  const active = useRef(null); // pointerId being drawn, or null
  const frame = useRef(0);
  const cssHeight = Math.round((cssWidth * H) / W);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cssWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(cssWidth * dpr);
    const ph = Math.round(cssHeight * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    paint(canvas.getContext("2d"), strokesRef.current, pw / W);
  }, [cssWidth, cssHeight, strokesRef]);

  useLayoutEffect(() => {
    repaint();
  }, [repaint, redrawKey]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const schedule = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(repaint);
  };
  const toLogical = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.min(W, Math.max(0, ((e.clientX - r.left) / r.width) * W)),
      y: Math.min(H, Math.max(0, ((e.clientY - r.top) / r.height) * H)),
    };
  };

  const onPointerDown = (e) => {
    if (active.current !== null || (e.pointerType === "mouse" && e.button !== 0)) return; // a second finger / palm: ignored
    e.preventDefault();
    active.current = e.pointerId;
    canvasRef.current.setPointerCapture?.(e.pointerId);
    strokesRef.current.push([toLogical(e)]);
    schedule();
  };
  const onPointerMove = (e) => {
    if (e.pointerId !== active.current) return;
    e.preventDefault();
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    const samples = e.nativeEvent.getCoalescedEvents?.() || [];
    for (const s of samples.length ? samples : [e]) stroke.push(toLogical(s));
    schedule();
  };
  const end = (e) => {
    if (e.pointerId !== active.current) return;
    active.current = null;
    canvasRef.current.releasePointerCapture?.(e.pointerId);
    schedule();
    onStroke?.(strokesRef.current.length);
  };

  return (
    <canvas
      ref={canvasRef}
      data-testid={testId}
      style={{
        display: "block",
        width: cssWidth || "100%",
        height: cssHeight || undefined,
        aspectRatio: `${W} / ${H}`,
        border,
        borderRadius: 12,
        background: "#FFFFFF",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        cursor: "crosshair",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

/** The width available to a pad inside `ref`'s element, capped at 600 px. */
function useAvailableWidth(ref) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.min(MAX_CSS_W, Math.floor(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

const btn = (kind, enabled = true) => ({
  minHeight: TOUCH_BTN,
  padding: "8px 18px",
  fontSize: 15,
  fontWeight: 600,
  borderRadius: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  cursor: enabled ? "pointer" : "not-allowed",
  ...(kind === "primary"
    ? { color: "#FFFFFF", background: enabled ? "#005CFF" : "#A0AEC0", border: "none" }
    : kind === "outline"
      ? { color: "#005CFF", background: "#FFFFFF", border: "1px solid #005CFF" }
      : { color: "#0D1B2A", background: "#F0F2F5", border: "1px solid #D1D5DB", opacity: enabled ? 1 : 0.55 }),
});

/**
 * Lock the page (window and any scrolling ancestors — the app shell scrolls
 * its <main>, not the window) while the overlay is open; restore positions on
 * close. overflow-y alone is touched and restored: the shell sets x and y
 * differently, which the `overflow` shorthand cannot round-trip.
 */
function lockScroll(from) {
  const saved = [];
  for (let el = from?.parentElement; el; el = el.parentElement) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) {
      saved.push({ el, top: el.scrollTop, overflowY: el.style.overflowY });
      el.style.overflowY = "hidden";
    }
  }
  const body = { overflowY: document.body.style.overflowY, x: window.scrollX, y: window.scrollY };
  document.body.style.overflowY = "hidden";
  return () => {
    document.body.style.overflowY = body.overflowY;
    window.scrollTo(body.x, body.y);
    for (const s of saved) {
      s.el.style.overflowY = s.overflowY;
      s.el.scrollTop = s.top;
    }
  };
}

/**
 * "เซ็นเต็มจอ": the pad as large as the screen allows at 5:2, big buttons,
 * page scroll locked. Starts from the pad's strokes; "ใช้ลายเซ็นนี้" hands
 * them back (onUse), "ปิด" discards.
 */
function FullScreenPad({ initial, useLabel, onUse, onClose }) {
  const strokesRef = useRef(initial.map((s) => s.slice()));
  const [count, setCount] = useState(strokesRef.current.length);
  const [rev, setRev] = useState(0);
  const [view, setView] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const size = () => setView({ w: window.innerWidth, h: window.innerHeight });
    size();
    window.addEventListener("resize", size);
    window.addEventListener("orientationchange", size);
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", size);
      window.removeEventListener("orientationchange", size);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const portrait = view.h > view.w;
  // Room for the title / hint row and the button row; the pad keeps 5:2.
  const padW = Math.max(0, Math.floor(Math.min(view.w - 24, ((view.h - (portrait ? 170 : 128)) * W) / H)));
  const undo = () => {
    strokesRef.current.pop();
    setCount(strokesRef.current.length);
    setRev((r) => r + 1);
  };
  const clear = () => {
    strokesRef.current = [];
    setCount(0);
    setRev((r) => r + 1);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="เซ็นเต็มจอ"
      data-testid="sig-fullscreen"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#F8FAFD", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 12, overscrollBehavior: "contain" }}
    >
      <div style={{ width: padW || "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 700, color: "#0D1B2A", fontSize: 16 }}>เซ็นชื่อในกรอบ</span>
        <button type="button" onClick={onClose} style={btn("light")} data-testid="sig-fs-close" aria-label="ปิด">
          <X size={18} /> ปิด
        </button>
      </div>
      {portrait && (
        <div style={{ width: padW || "100%", color: "#92400E", background: "#FEF3C7", borderRadius: 10, padding: "6px 10px", fontSize: 14 }} data-testid="sig-fs-rotate-hint">
          หมุนโทรศัพท์แนวนอนเพื่อเซ็นได้ถนัดขึ้น
        </div>
      )}
      {padW > 0 && <DrawingSurface strokesRef={strokesRef} cssWidth={padW} redrawKey={rev} onStroke={setCount} testId="sig-fullscreen-canvas" border="2px solid #005CFF" />}
      <div style={{ width: padW || "100%", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button type="button" onClick={clear} style={btn("light")} data-testid="sig-fs-clear">
          ล้าง
        </button>
        <button type="button" onClick={undo} disabled={!count} style={btn("light", !!count)} data-testid="sig-fs-undo">
          <Undo2 size={16} /> ย้อนกลับ
        </button>
        <button type="button" onClick={() => onUse(strokesRef.current)} disabled={!count} style={btn("primary", !!count)} data-testid="sig-fs-use">
          {useLabel}
        </button>
      </div>
    </div>,
    document.body
  );
}

export default function SignaturePad({
  onSave,
  onClear,
  label = "ลายเซ็น",
  required = false,
  hint = "เซ็นชื่อในกรอบ",
  clearLabel = "ล้าง",
  undoLabel = "ย้อนกลับ",
  confirmLabel = "ใช้ลายเซ็นนี้",
  resignLabel = "วาดใหม่",
  fullScreenLabel = "เซ็นเต็มจอ",
}) {
  const wrapRef = useRef(null);
  const rootRef = useRef(null);
  const strokesRef = useRef([]);
  const unlockRef = useRef(null);
  const [count, setCount] = useState(0);
  const [rev, setRev] = useState(0);
  const [preview, setPreview] = useState(null);
  const [fullScreen, setFullScreen] = useState(false);
  const width = useAvailableWidth(wrapRef);
  const narrow = useNarrow();

  const changed = () => {
    setCount(strokesRef.current.length);
    setRev((r) => r + 1);
  };
  const clear = () => {
    strokesRef.current = [];
    changed();
    setPreview(null);
    onClear?.();
  };
  const undo = () => {
    strokesRef.current.pop();
    changed();
  };
  const confirm = () => {
    if (!strokesRef.current.length) return;
    const png = exportPng(strokesRef.current);
    setPreview(png);
    onSave?.(png);
  };

  const openFull = () => {
    unlockRef.current = lockScroll(rootRef.current);
    setFullScreen(true);
  };
  const closeFull = useCallback(() => {
    setFullScreen(false);
    unlockRef.current?.();
    unlockRef.current = null;
  }, []);
  useEffect(() => () => unlockRef.current?.(), []);
  const applyFull = (strokes) => {
    strokesRef.current = strokes.map((s) => s.slice());
    changed();
    closeFull();
    confirm(); // straight into the normal flow: preview + onSave, as the pad's own button does
  };

  const title = (
    <span style={{ fontWeight: 600, color: "#0D1B2A", fontSize: 14 }}>
      {label}
      {required && <span style={{ color: "#E53E3E" }}> *</span>}
    </span>
  );

  if (preview) {
    return (
      <div ref={rootRef} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        {title}
        <div style={{ border: "1px solid rgba(0,92,255,0.20)", borderRadius: 12, padding: 8, background: "#FFFFFF", alignSelf: "flex-start", maxWidth: "100%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="ลายเซ็น" data-testid="sig-pad-preview" style={{ width: W, maxWidth: "100%", height: "auto", display: "block" }} />
        </div>
        <button type="button" onClick={clear} style={{ ...btn("outline"), alignSelf: "flex-start" }}>
          {resignLabel}
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      {title}
      <div ref={wrapRef} style={{ width: "100%", maxWidth: MAX_CSS_W }}>
        {width > 0 && <DrawingSurface strokesRef={strokesRef} cssWidth={width} redrawKey={rev} onStroke={setCount} testId="sig-pad-canvas" />}
      </div>
      <span style={{ color: "#5E6A7E", fontSize: 12 }}>{hint}</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={clear} style={btn("light")} data-testid="sig-pad-clear">
          {clearLabel}
        </button>
        <button type="button" onClick={undo} disabled={!count} style={btn("light", !!count)} data-testid="sig-pad-undo">
          <Undo2 size={16} /> {undoLabel}
        </button>
        {narrow && (
          <button type="button" onClick={openFull} style={btn("outline")} data-testid="sig-pad-fullscreen">
            <Maximize2 size={16} /> {fullScreenLabel}
          </button>
        )}
        <button type="button" onClick={confirm} disabled={!count} style={btn("primary", !!count)} data-testid="sig-pad-confirm">
          {confirmLabel}
        </button>
      </div>
      {fullScreen && <FullScreenPad initial={strokesRef.current} useLabel={confirmLabel} onUse={applyFull} onClose={closeFull} />}
    </div>
  );
}
