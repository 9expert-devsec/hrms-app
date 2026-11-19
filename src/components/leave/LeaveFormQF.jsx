/* eslint-disable @next/next/no-img-element */
/**
 * ใบแจ้งการลาป่วย ลากิจ และลาพักร้อน — paper form QF-HRD-001 REV.03, one A4
 * sheet (794 × 1123 px at 96 dpi), used on screen AND in print (the same
 * markup; LEAVE_FORM_CSS). Pure: no hooks, no fetching — `form` is
 * lib/leave/document.js leaveDocument().form.
 *
 * Box mapping:
 *   1. ความคิดเห็นหัวหน้างาน — the step-1 decider (approver 1 or 2), or
 *      "อนุมัติอัตโนมัติ — ไม่มีผู้บังคับบัญชา" for an auto-approve employee
 *   2. สำหรับผู้จัดการแผนก — the acknowledger, ticked only once acknowledged
 *   สำหรับแผนกทรัพยากรบุคคล — the HR signer (+ "(อนุมัติตนเอง)")
 * A step not done yet stays blank, like an unfilled paper form. Signatures
 * are the stored PNGs in their stored colours, sitting above their dotted line.
 */
import { formatLeaveAmount } from "@/lib/leave/format";
import { dateKeyOf } from "@/lib/leave/countLeave";

const MONTHS_LONG = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const ROWS = [
  { key: "sick", label: "ลาป่วย" },
  { key: "personal", label: "ลากิจ" },
  { key: "annual", label: "ลาพักร้อน" },
  { key: "other", label: "อื่นๆ" },
];
const STAT_ROWS = [
  { key: "sick", label: "ลาป่วย" },
  { key: "personal", label: "ลากิจ" },
  { key: "annual", label: "ลาพักร้อน" },
  { key: "other", label: "ลาอื่นๆ" },
];

const parts = (v) => {
  const k = dateKeyOf(v);
  if (!k) return null;
  const [y, m, d] = k.split("-").map(Number);
  return { y, m, d };
};
/** "19 พฤศจิกายน 2569" */
const longDate = (v) => {
  const p = parts(v);
  return p ? `${p.d} ${MONTHS_LONG[p.m - 1]} ${p.y + 543}` : "";
};
/** "3 ธ.ค. 2569" */
const shortDate = (v) => {
  const p = parts(v);
  return p ? `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y + 543}` : "";
};
/** "19 / 11 / 2569" */
const slashDate = (v) => {
  const p = parts(v);
  return p ? `${p.d} / ${p.m} / ${p.y + 543}` : "";
};

function timeText(f) {
  if (f.unit === "half_day") return f.halfDayPeriod === "afternoon" ? "ครึ่งวันบ่าย" : "ครึ่งวันเช้า";
  if (f.unit === "hourly") return `${f.startTime || ""}–${f.endTime || ""}`;
  return "เต็มวัน";
}

function Check({ on }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="lf-check">
      <rect x="0.5" y="0.5" width="11" height="11" fill="#fff" stroke="#000" strokeWidth="1" />
      {on && <path d="M2.4 6.2 L4.9 8.7 L9.7 3.2" fill="none" stroke="#000" strokeWidth="1.5" />}
    </svg>
  );
}

/** A value on a dotted underline; `w` = width in px (or flex when omitted). */
function V({ children, w, center = false, className = "" }) {
  return (
    <span className={`lf-v ${w ? "" : "lf-grow"} ${center ? "lf-center" : ""} ${className}`} style={w ? { width: w } : undefined}>
      {children}
    </span>
  );
}

/** "ลงชื่อ" + a signature above the dotted line. */
function SignLine({ src, w = 200, testid }) {
  return (
    <div className="lf-row lf-sign">
      <span>ลงชื่อ</span>
      <span className="lf-v lf-sigline" style={{ width: w }} data-testid={testid}>
        {src ? <img src={src} alt="" className="lf-sig" data-sig="1" /> : null}
      </span>
    </div>
  );
}

const Name = ({ name, note }) => (
  <div className="lf-name">
    ( {name ? <span className="lf-name-v">{name}</span> : <span className="lf-name-blank" />} )
    {note && <div className="lf-name-note">{note}</div>}
  </div>
);

export default function LeaveFormQF({ form: f, hoursPerDay = 8, className = "", testid = "leave-form" }) {
  const amt = (h, unit) => formatLeaveAmount(h, { unit, hoursPerDay });
  const row = f.category;
  const reasonText = row === "other" ? `${f.typeName} — ${f.reason}` : f.reason;
  const s1 = f.step1;
  const s1Decided = s1 && !s1.auto && (s1.decision === "approved" || s1.decision === "returned");
  const hr = f.hr && (f.hr.decision === "approved" || f.hr.decision === "returned") ? f.hr : null;
  const stats = Object.fromEntries((f.stats || []).map((r) => [r.category, r]));
  const stat = (h) => (h ? amt(h) : "–");
  const ll = f.lastLeave;

  return (
    <div className={`lf-paper ${className}`} data-testid={testid} data-watermark={f.watermark || ""}>
      {f.watermark && <div className="lf-watermark" aria-hidden="true">{f.watermark}</div>}

      <div className="lf-head">
        <img src="/brand/logo-blue-ink.png" alt="9Expert" className="lf-logo" />
        <h1 className="lf-title">ใบแจ้งการลาป่วย ลากิจ และลาพักร้อน</h1>
      </div>

      <div className="lf-row lf-right">
        <span>วันที่แจ้งลา</span>
        <V w={180} center>{longDate(f.submittedAt)}</V>
      </div>

      <div className="lf-row lf-mt">
        <b>เรื่อง</b>
        <V w={330}>{f.subject}</V>
      </div>
      <div className="lf-row">
        <b>เรียน</b>
        <V w={330}>{f.addressedTo}</V>
      </div>

      <div className="lf-row lf-mt">
        <span>ข้าพเจ้า</span>
        <V>{f.employeeName}</V>
        <span>ตำแหน่ง</span>
        <V w={220}>{f.position}</V>
      </div>
      <div className="lf-row">
        <span>แผนก</span>
        <V>{f.department}</V>
      </div>

      <div className="lf-req">
        <span className="lf-req-label">ขอ</span>
        <div className="lf-req-rows">
          {ROWS.map((r) => (
            <div key={r.key} className="lf-row" data-row={r.key} data-checked={row === r.key ? "1" : "0"}>
              <span className="lf-opt">
                <Check on={row === r.key} /> {r.label}
              </span>
              <V className="lf-clip">{row === r.key ? reasonText : ""}</V>
            </div>
          ))}
        </div>
      </div>

      <div className="lf-row lf-mt">
        <span>ตั้งแต่วันที่</span>
        <V w={98} center>{shortDate(f.startDate)}</V>
        <span>ถึงวันที่</span>
        <V w={98} center>{shortDate(f.endDate)}</V>
        <span>ตั้งแต่เวลา</span>
        <V w={92} center>{timeText(f)}</V>
        <span>จำนวน</span>
        <V w={68} center>{amt(f.totalHours, f.unit)}</V>
        <span>ชั่วโมง/วัน</span>
      </div>

      <div className="lf-row">
        <span>ข้าพเจ้าได้</span>
        {STAT_ROWS.map((r) => (
          <span key={r.key} className="lf-opt">
            <Check on={ll?.category === r.key} /> {r.label}
          </span>
        ))}
        <span>ครั้งล่าสุดตั้งแต่วันที่</span>
        <V className="lf-grow lf-center">{ll ? shortDate(ll.startDate) : ""}</V>
        <span>ถึงวันที่</span>
        <V className="lf-grow lf-center">{ll ? shortDate(ll.endDate) : ""}</V>
      </div>
      <div className="lf-row">
        <span>จำนวน</span>
        <V w={100} center>{ll ? amt(ll.totalHours, ll.unit) : ""}</V>
        <span>ชั่วโมง/วัน ระหว่างลาจะติดต่อข้าพเจ้าได้ที่</span>
        <V>{f.contact}</V>
      </div>

      <div className="lf-closing">
        <div>ขอแสดงความนับถือ</div>
        <SignLine src={f.employeeSignature} w={200} testid="sig-employee" />
        <Name name={f.employeeName} />
      </div>

      <div className="lf-boxes">
        <div className="lf-box" data-testid="box1">
          <div className="lf-box-title">1. ความคิดเห็นหัวหน้างาน</div>
          {s1?.auto ? (
            <div className="lf-auto">อนุมัติอัตโนมัติ — ไม่มีผู้บังคับบัญชา</div>
          ) : (
            <>
              <div className="lf-row lf-center-row">
                <span>คำสั่ง</span>
                <span className="lf-opt"><Check on={s1Decided && s1.decision === "approved"} /> อนุมัติ</span>
                <span className="lf-opt"><Check on={s1Decided && s1.decision === "returned"} /> ไม่อนุมัติ</span>
              </div>
              <div className="lf-row">
                <span>เหตุผล</span>
                <V className="lf-clip">{s1Decided ? s1.note : ""}</V>
              </div>
              <SignLine src={s1Decided ? s1.signature : ""} w={200} testid="sig-step1" />
              <Name name={s1Decided ? s1.name : ""} />
              <div className="lf-row lf-center-row">
                <span>วันที่</span>
                <V w={150} center>{s1Decided ? slashDate(s1.at) : ""}</V>
              </div>
            </>
          )}
        </div>

        <div className="lf-box" data-testid="box2">
          <div className="lf-box-title">2. สำหรับผู้จัดการแผนก</div>
          {!s1?.auto && (
            <>
              <div className="lf-row lf-center-row" data-checked={f.ack ? "1" : "0"}>
                <span className="lf-opt"><Check on={!!f.ack} /> รับทราบ</span>
              </div>
              <SignLine src={f.ack?.signature || ""} w={200} testid="sig-ack" />
              <Name name={f.ack?.name || ""} />
              <div className="lf-row lf-center-row">
                <span>วันที่</span>
                <V w={150} center>{f.ack ? slashDate(f.ack.at) : ""}</V>
              </div>
            </>
          )}
        </div>
      </div>

      <hr className="lf-divider" />

      <div className="lf-hr">
        <div className="lf-hr-left">
          <div className="lf-hr-title">สำหรับแผนกทรัพยากรบุคคล</div>
          <div className="lf-hr-sub">สถิติการลาในปีงบประมาณนี้</div>
          <table className="lf-table" data-testid="form-stats">
            <thead>
              <tr>
                <th>ประเภทลา</th>
                <th>ลามาแล้ว (ชม./วัน)</th>
                <th>ลาครั้งนี้ (ชม./วัน)</th>
                <th>รวมวันลาสะสม (ชม./วัน)</th>
              </tr>
            </thead>
            <tbody>
              {STAT_ROWS.map((r) => (
                <tr key={r.key} data-category={r.key}>
                  <td>{r.label}</td>
                  <td>{stat(stats[r.key]?.before)}</td>
                  <td>{stat(stats[r.key]?.now)}</td>
                  <td>{stat(stats[r.key]?.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="lf-hr-right" data-testid="box-hr">
          <div className="lf-row lf-center-row">
            <span className="lf-opt"><Check on={hr?.decision === "approved"} /> อนุมัติ</span>
            <span className="lf-opt"><Check on={hr?.decision === "returned"} /> ไม่อนุมัติ</span>
          </div>
          <div className="lf-row">
            <span>เหตุผล</span>
            <V className="lf-clip">{hr ? hr.note : ""}</V>
          </div>
          <SignLine src={hr?.signature || ""} w={180} testid="sig-hr" />
          <Name name={hr?.name || ""} note={hr?.selfApproved ? "(อนุมัติตนเอง)" : null} />
          <div className="lf-center">แผนกทรัพยากรบุคคล</div>
          <div className="lf-row lf-center-row">
            <span>วันที่</span>
            <V w={140} center>{hr ? slashDate(hr.at) : ""}</V>
          </div>
        </div>
      </div>

      <div className="lf-notes">
        <div className="lf-notes-row">
          <b className="lf-u">หมายเหตุ :</b>
          <div>
            <div>-การลาจะมีผลสมบูรณ์ก็ต่อเมื่อใบแจ้งการลาได้รับการอนุมัติจากแผนกทรัพยากรบุคคลเรียบร้อยแล้วเท่านั้น</div>
            <div>
              -หลังจากได้รับอนุมัติการลาทุกกรณี พนักงานจะต้องบันทึกข้อมูลใน Calendar และ Portal ขององค์กรด้วยตนเองก่อนการลา ( ยกเว้นการลาที่เกิดขึ้นแบบฉุกเฉินให้บันทึกข้อมูลย้อนหลังได้ )
            </div>
          </div>
        </div>
        <div className="lf-docno">QF-HRD-001 REV.03</div>
      </div>
    </div>
  );
}

/**
 * The form's CSS (screen + print). `.lf-print-portal` holds a second copy of
 * the form directly under <body>; in print everything else is hidden, so the
 * page prints the form alone — no shell — on one A4 sheet.
 */
export const LEAVE_FORM_CSS = `
.lf-paper { position: relative; width: 794px; height: 1123px; box-sizing: border-box; padding: 34px 66px 0; background: #fff; color: #000; overflow: hidden;
  font-family: var(--font-line-seed), "Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif; font-size: 13.5px; line-height: 1.45; }
.lf-paper * { box-sizing: border-box; }
.lf-paper b { font-weight: 700; }
.lf-head { text-align: center; }
.lf-logo { display: block; height: 40px; width: auto; margin: 0 auto 4px; object-fit: contain; }
.lf-title { margin: 0 0 6px; font-size: 21px; font-weight: 700; line-height: 1.35; font-family: inherit; color: #000; }
.lf-row { display: flex; align-items: flex-end; gap: 6px; min-height: 26px; white-space: nowrap; }
.lf-row .lf-opt { gap: 4px; }
.lf-right { justify-content: flex-end; }
.lf-center-row { justify-content: center; }
.lf-mt { margin-top: 8px; }
.lf-v { display: inline-block; min-height: 20px; border-bottom: 1px dotted #000; padding: 0 6px; line-height: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.lf-grow { flex: 1 1 0; min-width: 40px; }
.lf-center { text-align: center; }
.lf-clip { flex: 1 1 0; min-width: 40px; }
.lf-opt { display: inline-flex; align-items: center; gap: 5px; }
.lf-check { flex: none; display: inline-block; }
.lf-req { display: flex; gap: 22px; margin-top: 6px; }
.lf-req-label { padding-top: 4px; }
.lf-req-rows { flex: 1; }
.lf-req-rows .lf-opt { width: 92px; }
.lf-closing { margin: 10px 0 0 auto; width: 300px; text-align: center; }
.lf-sign { justify-content: center; }
.lf-sigline { position: relative; height: 40px; }
.lf-sig { position: absolute; left: 0; right: 0; bottom: 1px; margin: 0 auto; max-width: 100%; max-height: 38px; object-fit: contain; }
.lf-name { text-align: center; min-height: 22px; }
.lf-name-blank { display: inline-block; width: 160px; }
.lf-name-note { font-size: 12px; }
.lf-boxes { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 10px; }
.lf-box-title { font-weight: 700; text-align: center; margin-bottom: 2px; }
.lf-auto { margin-top: 10px; text-align: center; font-weight: 600; }
.lf-divider { border: 0; border-top: 2px solid #000; margin: 14px 0 10px; }
.lf-hr { display: grid; grid-template-columns: 1.75fr 1fr; gap: 22px; }
.lf-hr-title { font-weight: 700; text-decoration: underline; }
.lf-hr-sub { font-weight: 700; margin-bottom: 6px; }
.lf-table { width: 100%; border-collapse: collapse; font-size: 12px; line-height: 1.3; }
.lf-table th, .lf-table td { border: 1px solid #000; padding: 4px 6px; text-align: center; font-family: inherit; }
.lf-table th { font-weight: 600; }
.lf-table td:first-child, .lf-table th:first-child { text-align: left; white-space: nowrap; width: 76px; }
.lf-table th { font-size: 11px; }
.lf-notes { position: absolute; left: 66px; right: 66px; bottom: 30px; font-size: 12px; line-height: 1.5; }
.lf-notes-row { display: flex; gap: 8px; }
.lf-u { text-decoration: underline; white-space: nowrap; }
.lf-docno { margin-top: 14px; text-align: right; color: #666; font-size: 11px; }
.lf-watermark { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 120px; font-weight: 800; color: rgba(185, 28, 28, 0.13); white-space: nowrap; pointer-events: none; z-index: 2;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.lf-print-portal { display: none; }
@page { size: A4 portrait; margin: 0; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; overflow: visible !important; }
  body > *:not(.lf-print-portal) { display: none !important; }
  .lf-print-portal { display: block !important; }
  .lf-print-portal .lf-paper { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; page-break-after: avoid; break-after: avoid; }
  .lf-paper img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
