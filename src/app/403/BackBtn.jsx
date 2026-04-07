"use client";
import { useRouter } from "next/navigation";

export default function BackBtn({ children = "Back", className = "" }) {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard"); // กรณีกด Back ไม่ได้
    }
  };

  return (
    <button onClick={goBack} className={className}>
      {children}
    </button>
  );
}
