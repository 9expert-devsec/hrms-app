/* eslint-disable @next/next/no-img-element */
/**
 * "แบบฟอร์มการเบิกเบี้ยเลี้ยงการทำงานนอกสถานที่" — the printable form, laid out
 * like the official paper form (Rev.5, 1 June 2026): page 1 the form as
 * running lines with dotted fill-ins, page 2 the regulations
 * (lib/offsiteRegulations.js). Two exact A4 sheets; black on white.
 * Server-renderable (no hooks): `r` is a serialized OffsiteRequest.
 * Printing / "save as PDF" is the browser's (window.print — PrintButton).
 */
import {
  MAX_MEMBERS,
  SELF_APPROVAL_LABEL,
  TRAVEL_MODES,
  formatBaht,
  formatDateLongTh,
  workDateParts,
} from "@/lib/offsiteRules";
import { OFFSITE_REGULATIONS } from "@/lib/offsiteRegulations";

// Wording of the paper form (the app's own labels are shorter).
const TRAVEL_LABELS = {
  self_from_company: "เดินทางเองจากบริษัทฯ",
  company_van: "เดินทางโดยรถตู้บริษัทฯ",
  from_lodging: "เดินทางจากที่พัก",
};
const SIGN_COLUMNS = [
  { step: 1, title: "หัวหน้าแผนก/ ผู้รับผิดชอบ" },
  { step: 2, title: "ผู้ตรวจสอบ" },
  { step: 3, title: "ฝ่ายบุคคล" },
];
const NBSP = " ";

/** Times as written on the form: "09:00" → "09.00". */
const dotTime = (t) => String(t || "").replace(":", ".");

function Box({ checked }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="pf-mark">
      <rect x="0.6" y="0.6" width="10.8" height="10.8" fill="#fff" stroke="#000" strokeWidth="1" />
      {checked && <path d="M2.4 6.2 L4.9 8.7 L9.8 3.2" fill="none" stroke="#000" strokeWidth="1.5" />}
    </svg>
  );
}

function Radio({ checked }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="pf-mark">
      <circle cx="6" cy="6" r="5.4" fill="#fff" stroke="#000" strokeWidth="1" />
      {checked && <circle cx="6" cy="6" r="3" fill="#000" />}
    </svg>
  );
}

/** A label (on white — no dots under it). */
const L = ({ children }) => <span className="pf-l">{children}</span>;
/**
 * A value on the dotted line: `w` = share of the remaining width (flex-grow),
 * `width` = a fixed width, `fit` = exactly as wide as the value (min `fit`).
 */
const V = ({ children, w = 1, width, fit }) => (
  <span
    className={`pf-v${fit ? " pf-fit" : ""}`}
    style={fit ? { flex: "0 0 auto", minWidth: fit } : width ? { flex: `0 0 ${width}` } : { flex: `${w} 1 0` }}
  >
    {children}
  </span>
);

/** One running line with a dotted rule along its foot. */
const Row = ({ children, indent }) => <div className={`pf-row${indent ? " pf-indent" : ""}`}>{children}</div>;

/** A label and free text written over `rows` dotted lines (wraps; extra lines stay empty). */
function RuledBlock({ label, text, rows }) {
  return (
    <div className="pf-ruled" style={{ height: `calc(${rows} * var(--lh))` }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="pf-rule" style={{ top: `calc(${i + 1} * var(--lh) - var(--dot-lift))` }} />
      ))}
      <div className="pf-ruled-text">
        <span className="pf-l pf-l-inline">{label}</span>
        {text ? ` ${text}` : ""}
      </div>
    </div>
  );
}

function Regulations() {
  const items = (list, depth = 0) => (
    <ol className="pf-reg-list" style={{ marginLeft: depth ? "7mm" : 0 }}>
      {list.map((it) => (
        <li key={it.n}>
          <span className="pf-reg-n">{it.n}</span> {it.text}
          {it.children && items(it.children, depth + 1)}
        </li>
      ))}
    </ol>
  );
  return (
    <div className="pf-reg">
      <h2 className="pf-reg-title">{OFFSITE_REGULATIONS.title}</h2>
      {OFFSITE_REGULATIONS.sections.map((s) => (
        <section key={s.heading} className="pf-reg-sec">
          <h3>{s.heading}</h3>
          {s.bullets && (
            <ul className="pf-reg-bullets">
              {s.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {s.note && (
            <p className="pf-reg-note">
              <u>{s.note.label}</u>: {s.note.text}
            </p>
          )}
          {s.items && items(s.items)}
        </section>
      ))}
    </div>
  );
}

export default function OffsitePrintForm({ r, printedAt }) {
  const date = workDateParts(r.workDate);
  const step = (n) => (r.approvals || []).find((a) => a.step === n) || {};
  const rows = Array.from({ length: MAX_MEMBERS }, (_, i) => r.members[i] || null);
  const hr = r.hrSummary || {};
  const watermark = r.status === "approved" ? null : r.status === "cancelled" ? "ยกเลิกแล้ว" : "ยังไม่อนุมัติ";
  const amountFor = (option) => (hr.allowanceOption === option && hr.amountPerPerson ? formatBaht(hr.amountPerPerson) : "");

  return (
    <div className="pf-doc" data-testid="offsite-print">
      {/* ── Page 1: the form ─────────────────────────────── */}
      <article className="pf-sheet">
        {watermark && (
          <div className="pf-watermark" aria-hidden="true">
            {watermark}
          </div>
        )}

        <header className="pf-head">
          <img src="/brand/logo-blue-ink.png" alt="9Expert" className="pf-logo" />
          <h1>แบบฟอร์มการเบิกเบี้ยเลี้ยงการทำงานนอกสถานที่</h1>
        </header>

        <Row indent>
          <L>ข้าพเจ้า</L>
          <V w={1.25}>{r.creatorNameTh}</V>
          <L>{NBSP}ตำแหน่ง</L>
          <V>{r.creatorPosition}</V>
        </Row>
        <Row>
          <L>แผนก</L>
          <V>{r.creatorDepartment}</V>
        </Row>
        <p className="pf-plain">มีความประสงค์ขอเบิกเบี้ยเลี้ยงในการทำงานนอกสถานที่ โดยมีรายละเอียด ดังนี้</p>
        <Row>
          <L>ชื่องาน</L>
          <V>{r.jobName}</V>
        </Row>
        <Row>
          <L>ในวันที่</L>
          <V fit="7mm">{date.day}</V>
          <L>เดือน</L>
          {/* The month takes what is left (longest: "พฤศจิกายน"). */}
          <V>{date.month}</V>
          <L>พ.ศ.</L>
          <V fit="9mm">{date.yearBE}</V>
          <L>{NBSP}ตั้งแต่เวลา</L>
          <V fit="10mm">{dotTime(r.startTime)}</V>
          <L>น. ถึงเวลา</L>
          <V fit="10mm">{dotTime(r.endTime)}</V>
          <L>น. (โดยประมาณ)</L>
        </Row>
        <RuledBlock label="อธิบายลักษณะงานโดยสังเขป" text={r.description} rows={3} />
        <Row>
          <L>ชื่อสถานที่ในการปฏิบัติงาน</L>
          <V>{r.placeName}</V>
        </Row>
        <Row>
          <L>ที่อยู่จุดหมาย</L>
          <V>{r.address}</V>
        </Row>
        <p className="pf-plain pf-travel">
          โดยการเดินทาง ดังนี้
          {TRAVEL_MODES.map((m) => (
            <span key={m} className="pf-opt">
              <Box checked={r.travelMode === m} /> {TRAVEL_LABELS[m]}
            </span>
          ))}
        </p>
        <p className="pf-plain pf-indent">
          รายชื่อผู้ร่วมทำงาน <u>(กรณีทำงานที่เดียวกันหลายท่านให้ระบุทุกท่านพร้อมหน้าที่ที่รับผิดชอบในงานและเซ็นชื่อรับทราบด้วยตนเองทุกครั้ง)</u>
        </p>
        {rows.map((m, i) => (
          <Row key={i} indent>
            <L>{i + 1}. ชื่อ</L>
            <V w={1.3}>{m?.nameSnapshot}</V>
            <L>หน้าที่</L>
            <V w={1.25}>
              {m ? `${m.duty}${r.leader === m.employee ? " (หัวหน้างาน)" : ""}` : ""}
            </V>
            <L>{NBSP}เซ็นชื่อ</L>
            <V width="26mm">{m?.signature ? <img src={m.signature} alt="" className="pf-msig" /> : null}</V>
          </Row>
        ))}
        <RuledBlock label="หมายเหตุ" text={r.note} rows={2} />

        <table className="pf-signs">
          <thead>
            <tr>
              {SIGN_COLUMNS.map((c) => (
                <th key={c.step}>{c.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {SIGN_COLUMNS.map(({ step: n }) => {
                const a = step(n);
                const signed = a.status === "approved" || a.status === "needs_reconfirm";
                return (
                  <td key={n}>
                    <div className="pf-sign-img">{signed && a.signature ? <img src={a.signature} alt="" /> : null}</div>
                    <div className="pf-sign-line" />
                    <div>( {signed ? a.approverName : NBSP.repeat(36)} )</div>
                    <div className="pf-sign-date">{signed ? formatDateLongTh(a.signedAt) : NBSP}</div>
                    {signed && a.selfApproval && <div className="pf-self">{SELF_APPROVAL_LABEL}</div>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>

        <section className="pf-hr">
          <div className="pf-hr-title">
            <u>สำหรับฝ่ายบุคคล</u>
          </div>
          <div className="pf-b">สรุปการเบิกเบี้ยเลี้ยง</div>
          <div className="pf-hr-opt">
            <Radio checked={hr.allowanceOption === "per_person"} />
            <L>เบี้ยเลี้ยง</L>
            <V width="22mm">{amountFor("per_person")}</V>
            <L>บาท/ ท่าน</L>
          </div>
          <div className="pf-hr-opt">
            <Radio checked={hr.allowanceOption === "per_person_plus_travel"} />
            <L>เบี้ยเลี้ยง</L>
            <V width="22mm">{amountFor("per_person_plus_travel")}</V>
            <L>บาท/ ท่าน และค่าเดินทางตามจริง (กรณีไปทำงานมากกว่า 1 ที่)</L>
          </div>
          <div className="pf-hr-opt">
            <Radio checked={hr.allowanceOption === "travel_actual"} /> ค่าเดินทางตามจริง
          </div>
          <div className="pf-hr-opt">
            <Radio checked={hr.allowanceOption === "no_allowance"} /> ไม่เบิกเบี้ยเลี้ยง
          </div>
          <Row>
            <L>
              <b>หมายเหตุ</b>
            </L>
            <V>{hr.note}</V>
          </Row>
        </section>

        <footer className="pf-foot">
          <span>เลขที่เอกสาร {r.docNo || "ยังไม่ออกเลข"}</span>
          <span>พิมพ์เมื่อ {printedAt}</span>
        </footer>
      </article>

      {/* ── Page 2: the regulations ──────────────────────── */}
      <article className="pf-sheet">
        <Regulations />
      </article>
    </div>
  );
}

/**
 * Two exact A4 sheets: on screen stacked on a grey background, in print one
 * sheet per page (@page margin 0; the sheets carry the ~20 mm margins).
 * Sizes are TH Sarabun New's 16 pt / 18 pt in Sarabun's larger drawing.
 */
export const PRINT_CSS = `
@page { size: A4 portrait; margin: 0; }
.pf-screen { background: #D1D5DB; min-height: 100dvh; padding: 16px 0 40px; }
.pf-toolbar { width: 210mm; max-width: calc(100vw - 32px); margin: 0 auto 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 14px; }
.pf-doc { --lh: 6.05mm; --dot-lift: 1.05mm; font-family: var(--font-sarabun), "TH Sarabun New", serif; color: #000; font-size: 12pt; line-height: var(--lh); }
.pf-sheet { position: relative; width: 210mm; height: 297mm; margin: 0 auto 12px; padding: 14mm 20mm 12mm; background: #fff; overflow: hidden; box-shadow: 0 4px 24px rgba(13,27,42,.18); box-sizing: border-box; }
.pf-head { margin-bottom: 1.5mm; }
.pf-logo { width: 45mm; height: auto; display: block; }
.pf-head h1 { text-align: center; font-size: 13.5pt; font-weight: 700; margin: 1.5mm 0 0; line-height: 1.4; }
.pf-row { position: relative; display: flex; align-items: flex-end; height: var(--lh); white-space: nowrap; }
.pf-row::after { content: ""; position: absolute; left: 0; right: 0; bottom: var(--dot-lift); border-bottom: 1.1px dotted #000; z-index: 0; }
.pf-indent { padding-left: 10mm; }
.pf-row.pf-indent::after { left: 10mm; }
.pf-l { position: relative; z-index: 1; background: #fff; padding-right: 1mm; height: var(--lh); display: inline-flex; align-items: flex-end; padding-bottom: 0; }
.pf-l + .pf-v { margin-left: 0; }
.pf-v { position: relative; z-index: 1; height: var(--lh); min-width: 0; overflow: hidden; text-overflow: ellipsis; text-align: center; padding: 0 1mm; display: block; }
.pf-fit { padding: 0 1.2mm; }
.pf-plain { margin: 0; line-height: var(--lh); }
.pf-travel { display: flex; align-items: center; gap: 0 5mm; white-space: nowrap; }
.pf-opt { display: inline-flex; align-items: center; gap: 1.5mm; }
.pf-mark { flex: none; position: relative; top: -0.2mm; }
.pf-ruled { position: relative; overflow: hidden; }
.pf-rule { position: absolute; left: 0; right: 0; border-bottom: 1.1px dotted #000; }
.pf-ruled-text { position: relative; z-index: 1; line-height: var(--lh); word-break: break-word; }
.pf-l-inline { display: inline-block; vertical-align: top; }
.pf-msig { position: absolute; left: 50%; bottom: calc(var(--dot-lift) - 0.6mm); transform: translateX(-50%); max-height: 7.6mm; max-width: 25mm; object-fit: contain; mix-blend-mode: multiply; }
.pf-signs { width: 100%; border-collapse: collapse; margin-top: 2.5mm; table-layout: fixed; }
.pf-signs th, .pf-signs td { border: 0.8px solid #000; text-align: center; }
.pf-signs th { font-weight: 700; padding: 0.4mm 1mm; }
.pf-signs td { padding: 0.5mm 2mm 1mm; vertical-align: top; }
.pf-sign-img { height: 12mm; display: flex; align-items: flex-end; justify-content: center; }
.pf-sign-img img { max-height: 11.5mm; max-width: 100%; object-fit: contain; mix-blend-mode: multiply; }
.pf-sign-line { border-bottom: 1.1px dotted #000; margin: 0 5mm 0.5mm; }
.pf-sign-date { font-size: 10pt; line-height: 1.3; }
.pf-self { font-size: 8.5pt; line-height: 1.3; }
.pf-hr { border: 0.8px solid #000; padding: 1mm 3mm 1.5mm; margin-top: 2.5mm; }
.pf-hr-title, .pf-b { font-weight: 700; }
.pf-hr-opt { display: flex; align-items: center; gap: 1.5mm; height: var(--lh); white-space: nowrap; }
.pf-hr-opt .pf-v { border-bottom: 1.1px dotted #000; height: auto; line-height: 1.2; }
.pf-hr-opt .pf-l { height: auto; }
.pf-foot { position: absolute; left: 20mm; right: 20mm; bottom: 6mm; display: flex; justify-content: space-between; font-size: 9pt; line-height: 1.2; color: #777; }
.pf-watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; font-size: 64pt; font-weight: 800; color: rgba(220, 38, 38, 0.13); transform: rotate(-32deg); white-space: nowrap; z-index: 5; }
.pf-reg { line-height: 1.55; }
.pf-reg-title { font-size: 13.5pt; font-weight: 700; text-align: center; margin: 0 0 3mm; }
.pf-reg-sec { margin-bottom: 3mm; }
.pf-reg-sec h3 { font-size: 12pt; font-weight: 700; margin: 0 0 1mm; }
.pf-reg-bullets { margin: 0; padding-left: 6mm; list-style: none; }
.pf-reg-bullets li { position: relative; }
.pf-reg-bullets li::before { content: "\\2022"; position: absolute; left: -4.5mm; }
.pf-reg-note { margin: 1mm 0 0; }
.pf-reg-list { list-style: none; padding: 0; margin-top: 0; margin-bottom: 0; }
.pf-reg-list li { padding-left: 9mm; text-indent: -9mm; }
.pf-reg-list .pf-reg-list li { padding-left: 11mm; text-indent: -11mm; }
.pf-reg-list .pf-reg-list .pf-reg-list li { padding-left: 13mm; text-indent: -13mm; }
.pf-reg-n { display: inline-block; text-indent: 0; }
@media print {
  html, body { background: #fff !important; margin: 0 !important; }
  .pf-screen { background: #fff; padding: 0; min-height: 0; }
  .pf-sheet { margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
  .pf-sheet:last-child { break-after: auto; page-break-after: auto; }
  .no-print, button[aria-label="Back to top"] { display: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
