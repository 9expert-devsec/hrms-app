"use client";

import { FileText, ImageIcon, Paperclip, X } from "lucide-react";
import { prepareUpload, uploadErrorMessage } from "@/lib/client/resizeImage";
import { FOCUS, LINE, MUTED, NAVY, SLATE, BLUE } from "../../../../../components/hr/hrUi";

/**
 * แนบไฟล์ (ถ้ามี) — the leave upload (moved from the first ขอลา page): images
 * are resized first (prepareUpload), anything still over 4 MB is refused,
 * then POST /api/upload/cloudinary. `value`: [{ id, url, publicId, name,
 * type, size, status: resizing | uploading | done | error, preview?, error? }].
 */
export default function LeaveAttachments({ value, onChange, required = false }) {
  const update = (id, patch) => onChange((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  async function addFiles(files) {
    for (const f of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`;
      const isImg = f.type.startsWith("image/");
      onChange((list) => [
        ...list,
        { id, name: f.name, size: f.size, type: isImg ? "image" : "document", status: isImg ? "resizing" : "uploading", url: "", publicId: "", preview: isImg ? URL.createObjectURL(f) : null },
      ]);
      try {
        const ready = await prepareUpload(f);
        update(id, { status: "uploading", name: ready.name, size: ready.size });
        const fd = new FormData();
        fd.append("file", ready);
        const res = await fetch("/api/upload/cloudinary", { method: "POST", body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(uploadErrorMessage(res, err));
        }
        const data = await res.json();
        update(id, { status: "done", url: data.url, publicId: data.publicId });
      } catch (err) {
        update(id, { status: "error", error: err.message });
      }
    }
  }

  return (
    <div>
      <label
        className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-3 text-[14px] focus-within:ring-2 focus-within:ring-[#005CFF]/30 ${FOCUS}`}
        style={{ border: `1px solid ${required && !value.some((a) => a.status === "done") ? "#F59E0B" : "#D6E0F0"}`, color: MUTED, background: "#FFFFFF" }}
      >
        <Paperclip size={16} aria-hidden style={{ color: SLATE }} />
        <span className="truncate">เลือกไฟล์ใบรับรองแพทย์ ฯลฯ (รูปภาพหรือ PDF ไม่เกิน 4MB)</span>
        <input
          type="file"
          className="sr-only"
          multiple
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
          data-testid="leave-attach-input"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            addFiles(files);
          }}
        />
      </label>

      {value.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {value.map((att) => (
            <li key={att.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "#F8FAFD", border: `1px solid ${LINE}` }} data-testid="leave-attachment" data-status={att.status}>
              {att.type === "image" && att.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={att.preview} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md" style={{ background: "#EEF4FF", color: BLUE }}>
                  {att.type === "image" ? <ImageIcon size={16} aria-hidden /> : <FileText size={16} aria-hidden />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                {att.url ? (
                  <a href={att.url} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-medium underline-offset-2 hover:underline" style={{ color: NAVY }}>{att.name}</a>
                ) : (
                  <p className="truncate text-[13px] font-medium" style={{ color: NAVY }}>{att.name}</p>
                )}
                <p className="text-[12px]" style={{ color: att.status === "error" ? "#B91C1C" : SLATE }}>
                  {att.status === "resizing" && "กำลังปรับขนาดรูป…"}
                  {att.status === "uploading" && "กำลังอัปโหลด…"}
                  {att.status === "done" && (att.size ? `${Math.max(1, Math.round(att.size / 1024))} KB` : "แนบแล้ว")}
                  {att.status === "error" && (att.error || "อัปโหลดไม่สำเร็จ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange((list) => list.filter((a) => a.id !== att.id))}
                aria-label={`นำ ${att.name} ออก`}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${FOCUS}`}
                style={{ color: SLATE }}
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
