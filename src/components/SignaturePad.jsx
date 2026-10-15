"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const CSS_WIDTH = 400;
const CSS_HEIGHT = 160;

export default function SignaturePad({
  onSave,
  onClear,
  label = "Signature",
  required = false,
}) {
  const canvasRef = useRef(null);
  const points = useRef([]);
  const isDrawing = useRef(false);
  const ctxRef = useRef(null);
  const dprRef = useRef(1);

  const [hasStrokes, setHasStrokes] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState(null);

  // Initialize canvas with retina support + white background
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    canvas.style.width = CSS_WIDTH + "px";
    canvas.style.height = CSS_HEIGHT + "px";
    canvas.width = CSS_WIDTH * dpr;
    canvas.height = CSS_HEIGHT * dpr;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // White background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CSS_WIDTH, CSS_HEIGHT);

    // Stroke style
    ctx.strokeStyle = "#0D1B2A";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.imageSmoothingEnabled = true;

    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * CSS_WIDTH,
      y: ((clientY - rect.top) / rect.height) * CSS_HEIGHT,
    };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);

    isDrawing.current = true;
    const pos = getPos(e);
    points.current = [pos];

    const ctx = ctxRef.current;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing.current) return;
    e.preventDefault();

    const ctx = ctxRef.current;
    const pos = getPos(e);
    points.current.push(pos);

    if (!hasStrokes) setHasStrokes(true);

    const len = points.current.length;

    if (len < 3) {
      // Not enough points for bezier — draw straight line
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      return;
    }

    // Quadratic bezier using last 3 points for smooth curves
    const p1 = points.current[len - 2];
    const p2 = points.current[len - 1];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX, midY);
  };

  const handlePointerUp = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    points.current = [];
    const ctx = ctxRef.current;
    ctx.beginPath();
  };

  const handlePointerLeave = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    points.current = [];
    const ctx = ctxRef.current;
    ctx.beginPath();
  };

  const handleClear = () => {
    initCanvas();
    setHasStrokes(false);
    setConfirmed(false);
    setPreview(null);
    points.current = [];
    isDrawing.current = false;
    onClear?.();
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL("image/png");
    setPreview(base64);
    setConfirmed(true);
    onSave?.(base64);
  };

  if (confirmed && preview) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontWeight: 600, color: "#0D1B2A", fontSize: 14 }}>
          {label}
          {required && <span style={{ color: "#E53E3E" }}> *</span>}
        </span>
        <div
          style={{
            border: "1px solid rgba(0,92,255,0.20)",
            borderRadius: 12,
            padding: 8,
            background: "#FFFFFF",
            display: "inline-block",
          }}
        >
          <img
            src={preview}
            alt="Signature"
            style={{
              width: 400,
              maxWidth: "100%",
              height: "auto",
              display: "block",
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleClear}
          style={{
            alignSelf: "flex-start",
            padding: "6px 16px",
            fontSize: 13,
            color: "#005CFF",
            background: "transparent",
            border: "1px solid #005CFF",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Re-sign
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontWeight: 600, color: "#0D1B2A", fontSize: 14 }}>
        {label}
        {required && <span style={{ color: "#E53E3E" }}> *</span>}
      </span>
      <canvas
        ref={canvasRef}
        style={{
          border: "1px solid rgba(0,92,255,0.20)",
          borderRadius: 12,
          background: "#FFFFFF",
          touchAction: "none",
          cursor: "crosshair",
          maxWidth: "100%",
          width: CSS_WIDTH,
          height: CSS_HEIGHT,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />
      <span style={{ color: "#5E6A7E", fontSize: 12 }}>
        Please sign within the box
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={handleClear}
          style={{
            padding: "8px 20px",
            fontSize: 14,
            color: "#0D1B2A",
            background: "#F0F2F5",
            border: "1px solid #D1D5DB",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!hasStrokes}
          style={{
            padding: "8px 20px",
            fontSize: 14,
            color: "#FFFFFF",
            background: hasStrokes ? "#005CFF" : "#A0AEC0",
            border: "none",
            borderRadius: 8,
            cursor: hasStrokes ? "pointer" : "not-allowed",
          }}
        >
          Confirm Signature
        </button>
      </div>
    </div>
  );
}
