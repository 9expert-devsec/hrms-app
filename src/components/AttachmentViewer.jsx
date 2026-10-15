"use client";

import { useState } from "react";
import { Paperclip, FileText, X, Download } from "lucide-react";

const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const SLATE = "#5E6A7E";
const ICE = "#F8FAFD";

const IMG_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

function isImageUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return IMG_EXTS.some((ext) => lower.includes(ext));
}

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Normalize: combine new attachments[] + legacy attachmentUrl into one array
function getAttachments(leave) {
  const list = [];
  if (Array.isArray(leave.attachments)) {
    list.push(...leave.attachments);
  }
  if (leave.attachmentUrl && !list.some((a) => a.url === leave.attachmentUrl)) {
    list.push({
      url: leave.attachmentUrl,
      name: "attachment",
      type: isImageUrl(leave.attachmentUrl) ? "image" : "document",
      size: 0,
    });
  }
  return list;
}

export function hasAttachments(leave) {
  return getAttachments(leave).length > 0;
}

function handleDownload(att) {
  const proxyUrl = `/api/leave/download?url=${encodeURIComponent(att.url)}&filename=${encodeURIComponent(att.name || "document")}`;
  const a = document.createElement("a");
  a.href = proxyUrl;
  a.download = att.name || "document";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function AttachmentViewer({ leave }) {
  const [lightbox, setLightbox] = useState(null);
  const attachments = getAttachments(leave);

  if (attachments.length === 0) return null;

  return (
    <>
      <div style={{ marginTop: 8 }}>
        <div className="flex items-center gap-1.5 mb-2">
          <Paperclip size={14} style={{ color: SLATE }} />
          <span style={{ color: NAVY, fontSize: 13, fontWeight: 600 }}>
            เอกสารแนบ ({attachments.length})
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, i) => {
            const isImg = att.type === "image" || isImageUrl(att.url);

            if (isImg) {
              return (
                <div
                  key={i}
                  onClick={() => setLightbox(att)}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 8,
                    overflow: "hidden",
                    cursor: "pointer",
                    border: "1px solid rgba(0,92,255,0.10)",
                    position: "relative",
                  }}
                >
                  <img
                    src={att.url}
                    alt={att.name || "attachment"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              );
            }

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleDownload(att)}
                className="flex items-center gap-2"
                style={{
                  background: ICE,
                  border: "1px solid rgba(0,92,255,0.10)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <FileText size={16} style={{ color: BLUE, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: NAVY, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                    {att.name || "document"}
                  </div>
                  {att.size > 0 && (
                    <div style={{ color: SLATE, fontSize: 11 }}>{fmtSize(att.size)}</div>
                  )}
                </div>
                <Download size={12} style={{ color: SLATE, flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.15)", color: "#FFFFFF" }}
          >
            <X size={20} />
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.name || "attachment"}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "85vh",
              objectFit: "contain",
              borderRadius: 8,
            }}
          />
          {lightbox.name && (
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 8 }}>
              {lightbox.name}
            </p>
          )}
        </div>
      )}
    </>
  );
}
