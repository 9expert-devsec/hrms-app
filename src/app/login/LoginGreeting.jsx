"use client";

import { useEffect, useState } from "react";

const TZ = "Asia/Bangkok";

const dateFmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function greetingFor(hour) {
  if (hour >= 5 && hour < 12) return "สวัสดีตอนเช้า";
  if (hour >= 12 && hour < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
}

// Built from parts so every engine prints the same shape:
// "วันพฤหัสบดีที่ 15 ตุลาคม 2569 · 16:59" (some ICU versions add "พ.ศ.").
function snapshot(now) {
  const d = Object.fromEntries(
    dateFmt.formatToParts(now).map((p) => [p.type, p.value])
  );
  const t = Object.fromEntries(
    timeFmt.formatToParts(now).map((p) => [p.type, p.value])
  );
  return {
    greeting: greetingFor(Number(t.hour)),
    line: `${d.weekday}ที่ ${d.day} ${d.month} ${d.year} · ${t.hour}:${t.minute}`,
  };
}

// Client-only: renders nothing until mounted, so server and first client
// pass match. min-h reserves the space so the layout does not jump.
export default function LoginGreeting() {
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(snapshot(new Date()));
    const id = setInterval(() => setNow(snapshot(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-[60px]" aria-live="off">
      {now && (
        <>
          <p className="text-xl font-semibold text-9e-ice">{now.greeting}</p>
          <p className="mt-1 text-[15px] text-9e-ice/70">{now.line}</p>
        </>
      )}
    </div>
  );
}
