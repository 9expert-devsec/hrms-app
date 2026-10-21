"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasInAppHistory } from "../../../../../components/NavTracker";

/**
 * "กลับ": the previous app page (the viewer just came from it, so they can
 * open it), else /dashboard — for a fresh tab or a link from another site.
 */
export default function BackButton({ className, style }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (hasInAppHistory() ? router.back() : router.push("/dashboard"))}
      className={`touch-44 ${className || ""}`}
      style={style}
    >
      <ArrowLeft size={14} /> กลับ
    </button>
  );
}
