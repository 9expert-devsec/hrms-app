/* eslint-disable @next/next/no-img-element */
/**
 * "แบบฟอร์มการเบิกเบี้ยเลี้ยงการทำงานนอกสถานที่" — the printable form, laid
 * out like the paper original, A4 portrait. Server-renderable (no hooks):
 * `r` is a serialized OffsiteRequest. Printing / "save as PDF" is the
 * browser's (window.print — PrintButton).
 */
import {
  ALLOWANCE_OPTIONS,
  ALLOWANCE_OPTION_LABELS,
  MAX_MEMBERS,
  SELF_APPROVAL_LABEL,
  TRAVEL_MODES,
  TRAVEL_MODE_LABELS,
  allowanceNeedsAmount,
  allowanceTotal,
  formatBaht,
  formatDateLongTh,
  workDateParts,
} from "@/lib/offsiteRules";

const SIGN_BOXES = [
  { step: 1, title: "หัวหน้าแผนก/ผู้รับผิดชอบ" },
  { step: 2, title: "ผู้ตรวจสอบ" },
  { step: 3, title: "ฝ่ายบุคคล" },
];

function Box({ checked }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true" className="os-mark">
      <rect x="0.75" y="0.75" width="11.5" height="11.5" fill="#fff" stroke="#111" strokeWidth="1" />
      {checked && <path d="M2.8 6.6 L5.3 9.2 L10.3 3.6" fill="none" stroke="#111" strokeWidth="1.6" />}
    </svg>
  );
}

function Radio({ checked }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true" className="os-mark">
      <circle cx="6.5" cy="6.5" r="5.75" fill="#fff" stroke="#111" strokeWidth="1" />
      {checked && <circle cx="6.5" cy="6.5" r="3.2" fill="#111" />}
    </svg>
  );
}

/** A value written on a dotted line. */
function Fill({ children, grow = false, min }) {
  return (
    <span className={`os-fill${grow ? " os-grow" : ""}`} style={min ? { minWidth: min } : undefined}>
      {children || " "}
    </span>
  );
}

export default function OffsitePrintForm({ r, printedAt }) {
  const date = workDateParts(r.workDate);
  const step = (n) => (r.approvals || []).find((a) => a.step === n) || {};
  const rows = Array.from({ length: MAX_MEMBERS }, (_, i) => r.members[i] || null);
  const hr = r.hrSummary || {};
  const total = allowanceTotal(hr, r.members.length);
  const watermark = r.status === "approved" ? null : r.status === "cancelled" ? "ยกเลิกแล้ว" : "ยังไม่อนุมัติ";

  return (
    <article className="os-sheet" data-testid="offsite-print">
      {watermark && (
        <div className="os-watermark" aria-hidden="true">
          {watermark}
        </div>
      )}

      <header className="os-head">
        <img src="/brand/logo-blue-ink.png" alt="9Expert" className="os-logo" />
        <h1>แบบฟอร์มการเบิกเบี้ยเลี้ยงการทำงานนอกสถานที่</h1>
      </header>

      <section className="os-lines">
        <p>
          ข้าพเจ้า <Fill grow>{r.creatorNameTh}</Fill> ตำแหน่ง <Fill min="38mm">{r.creatorPosition}</Fill> แผนก <Fill min="32mm">{r.creatorDepartment}</Fill>
        </p>
        <p>มีความประสงค์ขอเบิกเบี้ยเลี้ยงในการทำงานนอกสถานที่ โดยมีรายละเอียด ดังนี้</p>
        <p>
          ชื่องาน <Fill grow>{r.jobName}</Fill>
        </p>
        <p>
          ในวันที่ <Fill min="10mm">{date.day}</Fill> เดือน <Fill min="26mm">{date.month}</Fill> พ.ศ. <Fill min="14mm">{date.yearBE}</Fill> ตั้งแต่เวลา{" "}
          <Fill min="14mm">{r.startTime}</Fill> น. ถึงเวลา <Fill min="14mm">{r.endTime}</Fill> น. (โดยประมาณ)
        </p>
        <p>
          อธิบายลักษณะงานโดยสังเขป <Fill grow>{r.description}</Fill>
        </p>
        <p>
          ชื่อสถานที่ในการปฏิบัติงาน <Fill grow>{r.placeName}</Fill>
        </p>
        <p>
          ที่อยู่จุดหมาย <Fill grow>{r.address}</Fill>
        </p>
        <p className="os-travel">
          <span>โดยการเดินทาง ดังนี้</span>
          {TRAVEL_MODES.map((m) => (
            <span key={m} className="os-opt">
              <Box checked={r.travelMode === m} /> {TRAVEL_MODE_LABELS[m]}
            </span>
          ))}
        </p>
      </section>

      <section>
        <div className="os-subtitle">รายชื่อผู้ร่วมทำงาน</div>
        <table className="os-members">
          <thead>
            <tr>
              <th style={{ width: "8mm" }}>ลำดับ</th>
              <th>ชื่อ-นามสกุล</th>
              <th style={{ width: "52mm" }}>หน้าที่</th>
              <th style={{ width: "36mm" }}>เซ็นชื่อ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={i}>
                <td className="os-c">{i + 1}</td>
                <td>{m ? m.nameSnapshot : <span className="os-dots" />}</td>
                <td>{m ? `${m.duty}${r.leader === m.employee ? " (หัวหน้างาน)" : ""}` : <span className="os-dots" />}</td>
                <td className="os-c">{m?.signature ? <img src={m.signature} alt="" className="os-msig" /> : <span className="os-dots" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="os-note">
          หมายเหตุ <Fill grow>{r.note}</Fill>
        </p>
      </section>

      <section className="os-signs">
        {SIGN_BOXES.map(({ step: n, title }) => {
          const a = step(n);
          const signed = a.status === "approved" || a.status === "needs_reconfirm";
          return (
            <div key={n} className="os-sign">
              <div className="os-sign-title">{title}</div>
              <div className="os-sign-img">{signed && a.signature ? <img src={a.signature} alt="" /> : null}</div>
              <div className="os-sign-line" />
              <div>( {signed ? a.approverName : " ".repeat(30)} )</div>
              <div className="os-sign-date">วันที่ {signed ? formatDateLongTh(a.signedAt) : "......../......../........"}</div>
              {signed && a.selfApproval && <div className="os-self">{SELF_APPROVAL_LABEL}</div>}
            </div>
          );
        })}
      </section>

      <section className="os-hr">
        <div className="os-subtitle">สำหรับฝ่ายบุคคล</div>
        {ALLOWANCE_OPTIONS.map((o) => {
          const [before, after] = ALLOWANCE_OPTION_LABELS[o].split("…");
          const chosen = hr.allowanceOption === o;
          return (
            <div key={o} className="os-hr-opt">
              <Radio checked={chosen} /> {before}
              {allowanceNeedsAmount(o) && (
                <>
                  <Fill min="16mm">{chosen && hr.amountPerPerson ? formatBaht(hr.amountPerPerson) : ""}</Fill>
                  {after}
                </>
              )}
            </div>
          );
        })}
        {total && (
          <div className="os-total">
            รวม {total.count} ท่าน × {formatBaht(total.amount)} บาท = {formatBaht(total.total)} บาท
          </div>
        )}
        <p>
          หมายเหตุ <Fill grow>{hr.note}</Fill>
        </p>
      </section>

      <footer className="os-foot">
        <span>เลขที่เอกสาร {r.docNo || "ยังไม่ออกเลข"}</span>
        <span>พิมพ์เมื่อ {printedAt}</span>
      </footer>
    </article>
  );
}

/** Print CSS: A4 portrait, app chrome hidden, one page where it fits. */
export const PRINT_CSS = `
@page { size: A4 portrait; margin: 10mm 12mm; }
.os-page { background: #E5E7EB; min-height: 100dvh; padding: 16px 0 40px; font-family: var(--font-line-seed), var(--font-google-sans), sans-serif; color: #111; }
.os-toolbar { width: 186mm; margin: 0 auto 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 14px; }
.os-sheet { position: relative; width: 186mm; min-height: 273mm; margin: 0 auto; background: #fff; padding: 9mm 10mm; box-shadow: 0 4px 24px rgba(13,27,42,.15); font-size: 10.5pt; line-height: 1.45; overflow: hidden; }
.os-head { display: flex; align-items: center; gap: 6mm; border-bottom: 1.5px solid #111; padding-bottom: 2.5mm; margin-bottom: 3mm; }
.os-logo { height: 11mm; width: auto; }
.os-head h1 { flex: 1; text-align: center; font-size: 14pt; font-weight: 700; margin: 0; }
.os-lines p { margin: 0 0 1.4mm; display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 1.5mm; }
.os-fill { display: inline-block; border-bottom: 1px dotted #333; padding: 0 1.5mm; min-width: 20mm; text-align: center; }
.os-grow { flex: 1; text-align: left; }
.os-travel { gap: 1.5mm 5mm !important; }
.os-opt { display: inline-flex; align-items: center; gap: 1.5mm; }
.os-mark { flex: none; position: relative; top: 1px; }
.os-subtitle { font-weight: 700; margin: 2.5mm 0 1mm; }
.os-members { width: 100%; border-collapse: collapse; font-size: 10pt; }
.os-members th, .os-members td { border: 1px solid #555; padding: 0 1.5mm; height: 7.4mm; vertical-align: middle; }
.os-members th { height: 6mm; background: #F3F4F6; font-weight: 700; }
.os-c { text-align: center; }
.os-dots { display: block; border-bottom: 1px dotted #999; height: 3.5mm; }
.os-msig { max-height: 6.4mm; max-width: 32mm; object-fit: contain; vertical-align: middle; }
.os-note { margin: 1.5mm 0 0; display: flex; gap: 1.5mm; align-items: baseline; }
.os-signs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin-top: 3mm; }
.os-sign { border: 1px solid #555; padding: 1.5mm 2mm 2mm; text-align: center; font-size: 9.5pt; }
.os-sign-title { font-weight: 700; }
.os-sign-img { height: 13mm; display: flex; align-items: flex-end; justify-content: center; }
.os-sign-img img { max-height: 12.5mm; max-width: 100%; object-fit: contain; }
.os-sign-line { border-bottom: 1px dotted #333; margin: 0 4mm 1mm; }
.os-sign-date { color: #333; }
.os-self { margin-top: 1mm; display: inline-block; font-size: 8pt; border: 1px solid #B45309; color: #92400E; border-radius: 3mm; padding: 0 2mm; }
.os-hr { border: 1px solid #555; padding: 1mm 3mm 2mm; margin-top: 3mm; }
.os-hr .os-subtitle { margin-top: 0.5mm; }
.os-hr-opt { display: flex; align-items: baseline; gap: 1.5mm; flex-wrap: wrap; margin-bottom: 0.8mm; }
.os-total { font-weight: 700; margin: 1mm 0 0.5mm 5mm; }
.os-hr p { margin: 1mm 0 0; display: flex; gap: 1.5mm; align-items: baseline; }
.os-foot { display: flex; justify-content: space-between; font-size: 8pt; color: #555; margin-top: 3mm; }
.os-watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; font-size: 64pt; font-weight: 800; color: rgba(220, 38, 38, 0.13); transform: rotate(-32deg); white-space: nowrap; z-index: 5; }
@media print {
  html, body { background: #fff !important; }
  .os-page { background: #fff; padding: 0; min-height: 0; }
  .os-sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  .no-print, button[aria-label="Back to top"] { display: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
