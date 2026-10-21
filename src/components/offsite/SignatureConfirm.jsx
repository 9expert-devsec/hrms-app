"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, PenLine } from "lucide-react";
import SignatureInput, { shrinkSignature } from "../SignatureInput";
import { Button, ErrorBox, SLATE, NAVY, api } from "./ui";

/** Save a freshly drawn or uploaded signature as the caller's profile signature (400×160 PNG). */
export async function saveMySignature(dataUrl) {
  const png = await shrinkSignature(dataUrl);
  return api("/api/signature", { method: "PUT", body: { png } });
}

/** Draw or upload, with Thai labels; calls onSaved({ png }) once stored. */
export function SignatureDrawer({ onSaved, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const onSave = async (raw) => {
    setBusy(true);
    setError("");
    try {
      onSaved(await saveMySignature(raw));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <SignatureInput
        label="วาดลายเซ็นของคุณ"
        hint="เซ็นชื่อในกรอบ แล้วกด “บันทึกลายเซ็น” — ลายเซ็นนี้จะถูกบันทึกในโปรไฟล์ของคุณ"
        clearLabel="ล้าง"
        confirmLabel={busy ? "กำลังบันทึก…" : "บันทึกลายเซ็น"}
        resignLabel="วาดใหม่"
        onSave={onSave}
      />
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-xs underline" style={{ color: SLATE }}>
          ยกเลิก
        </button>
      )}
      <ErrorBox>{error}</ErrorBox>
    </div>
  );
}

function SignatureImage({ png }) {
  return (
    <div className="inline-block rounded-xl p-2" style={{ border: "1px solid rgba(0,92,255,0.20)", background: "#FFFFFF" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={png} alt="ลายเซ็นของฉัน" style={{ width: 300, maxWidth: "100%", height: "auto", display: "block" }} />
    </div>
  );
}

/**
 * Sign-anywhere block: "ใช้ลายเซ็นของฉัน" shows the saved signature (or the
 * pad to draw and save one first); only then does the confirm button enable.
 * The server copies the SAVED signature into the request — nothing drawn
 * here is sent with the action itself. `onEditingChange(open)` reports the
 * pad / upload being open, so a live refresh never pulls it away mid-signature.
 */
export default function SignatureConfirm({ title = "ลงนาม", note, confirmLabel = "ยืนยัน", onConfirm, busy = false, onEditingChange, children }) {
  const [state, setState] = useState("idle"); // idle | loading | shown | drawing
  const [png, setPng] = useState(null);
  const [error, setError] = useState("");

  const editingRef = useRef(onEditingChange);
  editingRef.current = onEditingChange;
  useEffect(() => {
    editingRef.current?.(state === "drawing");
  }, [state]);
  useEffect(() => () => editingRef.current?.(false), []);

  const useMine = async () => {
    setState("loading");
    setError("");
    try {
      const j = await api("/api/signature");
      if (j.png) {
        setPng(j.png);
        setState("shown");
      } else {
        setState("drawing");
      }
    } catch (e) {
      setError(e.message);
      setState("idle");
    }
  };

  return (
    <div className="space-y-3">
      <div style={{ color: NAVY, fontWeight: 600, fontSize: 15 }}>{title}</div>
      {note && <p style={{ color: SLATE, fontSize: 13 }}>{note}</p>}
      {children}

      {state === "idle" && (
        <Button variant="secondary" onClick={useMine}>
          <PenLine size={14} /> ใช้ลายเซ็นของฉัน
        </Button>
      )}
      {state === "loading" && (
        <div className="flex items-center gap-2 text-sm" style={{ color: SLATE }}>
          <Loader2 size={14} className="animate-spin" /> กำลังโหลดลายเซ็น…
        </div>
      )}
      {state === "drawing" && (
        <div className="space-y-2">
          <p className="text-sm" style={{ color: "#92400E" }}>
            {png ? "วาดหรืออัปโหลดลายเซ็นใหม่ — จะแทนที่ลายเซ็นในโปรไฟล์ของคุณ" : "คุณยังไม่มีลายเซ็นที่บันทึกไว้ กรุณาวาดหรืออัปโหลดแล้วบันทึกก่อน"}
          </p>
          <SignatureDrawer
            onSaved={(sig) => {
              setPng(sig.png);
              setState("shown");
            }}
            onCancel={png ? () => setState("shown") : null}
          />
        </div>
      )}
      {state === "shown" && png && (
        <div className="space-y-2">
          <SignatureImage png={png} />
          <div>
            <button type="button" onClick={() => setState("drawing")} className="text-xs underline" style={{ color: SLATE }}>
              แก้ไขลายเซ็น
            </button>
          </div>
        </div>
      )}

      <ErrorBox>{error}</ErrorBox>

      <Button disabled={state !== "shown" || !png || busy} onClick={onConfirm} data-testid="signature-confirm">
        {busy && <Loader2 size={14} className="animate-spin" />} {confirmLabel}
      </Button>
    </div>
  );
}

/** Own-profile page: show and replace the saved signature. */
export function SignatureManager({ initialPng }) {
  const [png, setPng] = useState(initialPng || null);
  const [drawing, setDrawing] = useState(!initialPng);
  const [savedAt, setSavedAt] = useState(null);
  return (
    <div className="space-y-4">
      {png && !drawing && (
        <>
          <SignatureImage png={png} />
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setDrawing(true)}>
              <PenLine size={14} /> แก้ไขลายเซ็น
            </Button>
            {savedAt && <span className="text-sm" style={{ color: "#166534" }}>บันทึกแล้ว</span>}
          </div>
        </>
      )}
      {drawing && (
        <SignatureDrawer
          onSaved={(sig) => {
            setPng(sig.png);
            setSavedAt(sig.updatedAt || Date.now());
            setDrawing(false);
          }}
          onCancel={png ? () => setDrawing(false) : null}
        />
      )}
      <p className="text-xs" style={{ color: SLATE }}>
        เอกสารที่ลงนามไปแล้วเก็บสำเนาลายเซ็น ณ เวลาที่ลงนาม — การแก้ไขลายเซ็นที่นี่ไม่เปลี่ยนเอกสารเดิม
      </p>
    </div>
  );
}
