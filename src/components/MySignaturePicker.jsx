"use client";

import { useEffect, useState } from "react";
import { Loader2, PenLine, CheckCircle2 } from "lucide-react";
import SignaturePad from "./SignaturePad";

const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const SLATE = "#5E6A7E";

/**
 * Signature step of the leave flow (request + approve), same pattern as the
 * off-site sign view: "ใช้ลายเซ็นของฉัน" (the saved signature — GET
 * /api/signature, the one store) or "วาดใหม่" with "บันทึกเป็นลายเซ็นหลักของฉัน"
 * (ticked by default when nothing is saved yet).
 *
 * onChange(null) until a signature is chosen or drawn, then
 * onChange({ png, saveAsMine }). The page sends `png` as the record's own
 * copy (changing one's saved signature later never alters it) and, after its
 * action succeeds, saves a drawn one as the person's signature when
 * `saveAsMine` (saveMySignature).
 */
export default function MySignaturePicker({ label = "ลายเซ็น", onChange }) {
  const [saved, setSaved] = useState(undefined); // undefined = loading, null = none saved
  const [mode, setMode] = useState(null); // null (nothing chosen) | "mine" | "draw"
  const [drawn, setDrawn] = useState(null);
  const [saveAsMine, setSaveAsMine] = useState(false);
  const [noneNotice, setNoneNotice] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let png = null;
      try {
        const res = await fetch("/api/signature", { cache: "no-store" });
        if (res.ok) png = (await res.json())?.png || null;
      } catch {
        // unreachable or unlinked account: behave as "nothing saved"
      }
      if (!alive) return;
      setSaved(png);
      setSaveAsMine(!png);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Report the current choice. onChange is left out of the deps on purpose:
  // a parent passing an inline function must not re-trigger this.
  useEffect(() => {
    if (mode === "mine" && saved) onChange?.({ png: saved, saveAsMine: false });
    else if (mode === "draw" && drawn) onChange?.({ png: drawn, saveAsMine });
    else onChange?.(null);
  }, [mode, drawn, saveAsMine, saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const useMine = () => {
    if (saved) {
      setNoneNotice(false);
      setMode("mine");
    } else {
      setNoneNotice(true); // nothing saved yet: draw one
      setMode("draw");
    }
  };
  const drawNew = () => {
    setNoneNotice(false);
    setDrawn(null);
    setMode("draw");
  };

  const choiceBtn = (active) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 10,
    border: `1px solid ${active ? BLUE : "rgba(0,92,255,0.25)"}`,
    background: active ? "rgba(0,92,255,0.08)" : "#FFFFFF",
    color: active ? BLUE : NAVY,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="my-signature-picker">
      <span style={{ fontWeight: 600, color: NAVY, fontSize: 14 }}>
        {label}
        <span style={{ color: "#E53E3E" }}> *</span>
      </span>

      {saved === undefined ? (
        <span className="inline-flex items-center gap-2" style={{ color: SLATE, fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" /> กำลังโหลดลายเซ็น…
        </span>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={useMine} style={choiceBtn(mode === "mine")} data-testid="sig-use-mine">
            <CheckCircle2 size={14} /> ใช้ลายเซ็นของฉัน
          </button>
          <button type="button" onClick={drawNew} style={choiceBtn(mode === "draw")} data-testid="sig-draw">
            <PenLine size={14} /> วาดใหม่
          </button>
        </div>
      )}

      {mode === "mine" && saved && (
        <div style={{ border: "1px solid rgba(0,92,255,0.20)", borderRadius: 12, padding: 8, background: "#FFFFFF", display: "inline-block", alignSelf: "flex-start" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={saved} alt="ลายเซ็นของฉัน" style={{ width: 300, maxWidth: "100%", height: "auto", display: "block" }} />
        </div>
      )}

      {mode === "draw" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {noneNotice && (
            <span style={{ color: "#92400E", fontSize: 13 }}>คุณยังไม่มีลายเซ็นที่บันทึกไว้ — วาดลายเซ็นด้านล่าง</span>
          )}
          <SignaturePad
            label="วาดลายเซ็น"
            hint="เซ็นชื่อในกรอบ แล้วกด “ใช้ลายเซ็นนี้”"
            clearLabel="ล้าง"
            confirmLabel="ใช้ลายเซ็นนี้"
            resignLabel="วาดใหม่"
            onSave={(base64) => setDrawn(base64)}
            onClear={() => setDrawn(null)}
          />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: NAVY, fontSize: 13 }}>
            <input type="checkbox" checked={saveAsMine} onChange={(e) => setSaveAsMine(e.target.checked)} data-testid="sig-save-as-mine" />
            บันทึกเป็นลายเซ็นหลักของฉัน
          </label>
        </div>
      )}
    </div>
  );
}
