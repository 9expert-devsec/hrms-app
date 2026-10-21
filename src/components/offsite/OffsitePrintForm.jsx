/* eslint-disable @next/next/no-img-element */
/**
 * "แบบฟอร์มการเบิกเบี้ยเลี้ยงการทำงานนอกสถานที่" — the printable form, built on
 * the measurements of the official Word original (Rev.5, 1 June 2026; A4
 * 595.3 × 841.9 pt): Angsana New (installed on the machine — never bundled),
 * pt metrics, typed-dot leaders. Page 1 the form, page 2 the regulations
 * (lib/offsiteRegulations.js). Server-renderable (no hooks); PrintFit shrinks
 * values that do not fit their dots. Printing is the browser's (PrintButton).
 *
 * Baselines in the original (pt from the top): title 93.0; "ข้าพเจ้า" 127.7,
 * then one line every 18.92 pt (member 10 at 543.8); หมายเหตุ 572.2 (+9.5);
 * signature table 606.1–687.7; HR box 698.9–814.6 (pitch 16.4).
 * In Chromium with Angsana New, a 14-pt baseline sits 12.75 pt below the top
 * of an 18.92-pt line box, 16 pt bold 16.5 pt in 24 pt, 12 pt 10.5 pt in 16.4 pt.
 */
import { MAX_MEMBERS, SELF_APPROVAL_LABEL, TRAVEL_MODES, formatBaht, formatDateLongTh, workDateParts } from "@/lib/offsiteRules";
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
// Page-2 numbered sections: x of each level from the text block's left edge
// (57.6 pt) and the hang of wrapped lines, as measured in the original.
const SECTION_INDENTS = {
  การเดินทาง: [{ left: 18, hang: 18 }, { left: 36, hang: 18 }],
  "ขั้นตอนการทำงานต่างๆ ดังนี้": [{ left: 11.3, hang: 18 }, { left: 29.3, hang: 13.6 }, { left: 45.1, hang: 13.6 }],
};
const NBSP = " ";

/** Times as written on the form: "09:00" → "09.00". */
const dotTime = (t) => String(t || "").replace(":", ".");

function Box({ checked }) {
  return (
    <svg width="9pt" height="9pt" viewBox="0 0 12 12" aria-hidden="true" className="pf-mark">
      <rect x="0.6" y="0.6" width="10.8" height="10.8" fill="#fff" stroke="#000" strokeWidth="0.9" />
      {checked && <path d="M2.4 6.2 L4.9 8.7 L9.8 3.2" fill="none" stroke="#000" strokeWidth="1.4" />}
    </svg>
  );
}

function Radio({ checked }) {
  return (
    <svg width="8pt" height="8pt" viewBox="0 0 12 12" aria-hidden="true" className="pf-mark">
      <circle cx="6" cy="6" r="5.4" fill="#fff" stroke="#000" strokeWidth="0.9" />
      {checked && <circle cx="6" cy="6" r="3" fill="#000" />}
    </svg>
  );
}

/** A label (no dots under it). */
const L = ({ children }) => <span className="pf-l">{children}</span>;

/**
 * A value typed into dots, left-aligned right after its label. `w` = share of
 * the remaining width, `width` = fixed width. PrintFit shrinks it to fit.
 */
const V = ({ children, w = 1, width, base = 14 }) => (
  <span className="pf-v" data-fit="line" data-base-pt={base} style={width ? { flex: `0 0 ${width}` } : { flex: `${w} 1 0` }}>
    {children}
  </span>
);

/** One running line; `indent` = first-line x offset, `width` = where the dots end (pt from the text block's left). */
const Row = ({ children, indent = 0, width }) => (
  <div className="pf-row" style={{ paddingLeft: indent ? `${indent}pt` : undefined, width: width ? `${width}pt` : undefined }}>
    {children}
  </div>
);

/** A label and free text written over `rows` dotted lines. */
function RuledBlock({ label, text, rows }) {
  return (
    <div className="pf-ruled" data-fit="block" data-base-pt="14" style={{ height: `calc(${rows} * var(--lh))` }}>
      <div className="pf-ruled-text">
        <span className="pf-l pf-l-inline">{label}</span>
        {text || ""}
      </div>
    </div>
  );
}

function Regulations() {
  const renderItems = (list, indents, depth = 0) =>
    list.map((it) => {
      const lvl = indents[Math.min(depth, indents.length - 1)];
      return (
        <div key={it.n}>
          <p className="pf-reg-item" style={{ paddingLeft: `${lvl.left + lvl.hang}pt`, textIndent: `-${lvl.hang}pt` }}>
            {it.n} {it.text}
          </p>
          {it.children && renderItems(it.children, indents, depth + 1)}
        </div>
      );
    });
  return (
    <div className="pf-p2">
      <p className="pf-b">{OFFSITE_REGULATIONS.title}</p>
      {OFFSITE_REGULATIONS.sections.map((s, i) => (
        <section key={s.heading}>
          {/* The first section's lead line is regular weight and indented; the others are bold headings after a blank line. */}
          {i === 0 ? (
            <p style={{ paddingLeft: "18pt" }}>{s.heading}</p>
          ) : (
            <p className="pf-b pf-reg-heading">{s.heading}</p>
          )}
          {s.bullets?.map((b) => (
            <p key={b} className="pf-reg-bullet">
              <span className="pf-reg-dot">•</span>
              {b}
            </p>
          ))}
          {s.note && (
            <p style={{ paddingLeft: "18pt" }}>
              <u>{s.note.label}</u>: {s.note.text}
            </p>
          )}
          {s.items && renderItems(s.items, SECTION_INDENTS[s.heading] || SECTION_INDENTS.การเดินทาง)}
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
        <img src="/brand/logo-blue-ink.png" alt="9Expert" className="pf-logo" />
        <h1 className="pf-title">แบบฟอร์มการเบิกเบี้ยเลี้ยงการทำงานนอกสถานที่</h1>

        <div className="pf-body">
          <Row indent={35.4} width={466.4}>
            <L>ข้าพเจ้า</L>
            <V w={1.3}>{r.creatorNameTh}</V>
            <L>{NBSP}ตำแหน่ง</L>
            <V>{r.creatorPosition}</V>
          </Row>
          <Row width={249.6}>
            <L>แผนก</L>
            <V>{r.creatorDepartment}</V>
          </Row>
          <p className="pf-line">มีความประสงค์ขอเบิกเบี้ยเลี้ยงในการทำงานนอกสถานที่ โดยมีรายละเอียด ดังนี้</p>
          <Row width={474.6}>
            <L>ชื่องาน</L>
            <V>{r.jobName}</V>
          </Row>
          <Row width={473.5}>
            <L>ในวันที่</L>
            <V width="34pt">{date.day}</V>
            <L>เดือน</L>
            <V width="70pt">{date.month}</V>
            <L>พ.ศ.</L>
            <V width="38pt">{date.yearBE}</V>
            <L>{NBSP}ตั้งแต่เวลา</L>
            <V width="38pt">{dotTime(r.startTime)}</V>
            <L>น. ถึงเวลา</L>
            <V width="38pt">{dotTime(r.endTime)}</V>
            <L>น. (โดยประมาณ)</L>
          </Row>
          <RuledBlock label="อธิบายลักษณะงานโดยสังเขป" text={r.description} rows={3} />
          <Row>
            <L>ชื่อสถานที่ในการปฏิบัติงาน</L>
            <V>{r.placeName}</V>
          </Row>
          <Row width={477.6}>
            <L>ที่อยู่จุดหมาย</L>
            <V>{r.address}</V>
          </Row>
          <p className="pf-line pf-travel">
            โดยการเดินทาง ดังนี้
            {TRAVEL_MODES.map((m) => (
              <span key={m} className="pf-opt">
                <Box checked={r.travelMode === m} />
                {TRAVEL_LABELS[m]}
              </span>
            ))}
          </p>
          <p className="pf-line pf-members-head">
            รายชื่อผู้ร่วมทำงาน{" "}
            <u>(กรณีทำงานที่เดียวกันหลายท่านให้ระบุทุกท่านพร้อมหน้าที่ที่รับผิดชอบในงานและเซ็นชื่อรับทราบด้วยตนเองทุกครั้ง)</u>
          </p>
          {rows.map((m, i) => (
            <Row key={i} indent={36} width={472.8}>
              <L>{i + 1}. ชื่อ</L>
              <V w={1.25}>{m?.nameSnapshot}</V>
              <L>หน้าที่</L>
              <V w={1.1}>{m ? `${m.duty}${r.leader === m.employee ? " (หัวหน้างาน)" : ""}` : ""}</V>
              <L>{NBSP}เซ็นชื่อ</L>
              <span className="pf-v pf-sigslot">{m?.signature ? <img src={m.signature} alt="" className="pf-msig" /> : null}</span>
            </Row>
          ))}
          <div className="pf-note">
            <RuledBlock label="หมายเหตุ" text={r.note} rows={2} />
          </div>

          <div className="pf-signs">
            {SIGN_COLUMNS.map(({ step: n, title }) => {
              const a = step(n);
              const signed = a.status === "approved" || a.status === "needs_reconfirm";
              return (
                <div key={n} className="pf-sign">
                  <div className="pf-sign-head">{title}</div>
                  {signed && a.signature ? <img src={a.signature} alt="" className="pf-sign-img" /> : null}
                  <div className="pf-sign-dots" />
                  <div className="pf-sign-name">( {signed ? a.approverName : NBSP.repeat(30)} )</div>
                  {signed && (
                    <div className="pf-sign-date">
                      {formatDateLongTh(a.signedAt)}
                      {a.selfApproval ? ` · ${SELF_APPROVAL_LABEL}` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <section className="pf-hr">
            <div className="pf-hr-line pf-b">
              <u>สำหรับฝ่ายบุคคล</u>
            </div>
            <div className="pf-hr-line pf-b">สรุปการเบิกเบี้ยเลี้ยง</div>
            <div className="pf-hr-line">
              <Radio checked={hr.allowanceOption === "per_person"} />
              <L>เบี้ยเลี้ยง</L>
              <V width="38pt" base={12}>
                {amountFor("per_person")}
              </V>
              <L>บาท/ ท่าน</L>
            </div>
            <div className="pf-hr-line">
              <Radio checked={hr.allowanceOption === "per_person_plus_travel"} />
              <L>เบี้ยเลี้ยง</L>
              <V width="38pt" base={12}>
                {amountFor("per_person_plus_travel")}
              </V>
              <L>บาท/ ท่าน และค่าเดินทางตามจริง (กรณีไปทำงานมากกว่า 1 ที่)</L>
            </div>
            {/* The original has three options; "ไม่เบิกเบี้ยเลี้ยง" shares this line so the box keeps its six lines. */}
            <div className="pf-hr-line">
              <Radio checked={hr.allowanceOption === "travel_actual"} />
              <L>ค่าเดินทางตามจริง</L>
              <span className="pf-hr-gap" />
              <Radio checked={hr.allowanceOption === "no_allowance"} />
              <L>ไม่เบิกเบี้ยเลี้ยง</L>
            </div>
            <div className="pf-hr-line">
              <L>
                <b>หมายเหตุ</b>
              </L>
              <V base={12}>{hr.note}</V>
            </div>
          </section>
        </div>

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
 * Two exact A4 sheets in pt, positioned from the page edge (@page margin 0).
 * Font: Angsana New from the machine (local(); never bundled or served),
 * then AngsanaUPC, then the Sarabun / serif fallback.
 */
export const PRINT_CSS = `
@font-face { font-family: "PF Angsana"; src: local("Angsana New"), local("AngsanaNew"); font-weight: 400; font-style: normal; }
@font-face { font-family: "PF Angsana"; src: local("Angsana New Bold"), local("AngsanaNew-Bold"); font-weight: 700; font-style: normal; }
@page { size: A4 portrait; margin: 0; }
.pf-screen { background: #D1D5DB; min-height: 100dvh; padding: 16px 0 40px; }
.pf-toolbar { width: 595.28pt; max-width: calc(100vw - 32px); margin: 0 auto 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 14px; }
.pf-font-note { width: 595.28pt; max-width: calc(100vw - 32px); margin: 0 auto 12px; padding: 8px 12px; border-radius: 8px; background: #FEF3C7; color: #92400E; font-size: 13px; }
.pf-doc {
  --lh: 18.92pt; --dot-y: 12.2pt; --dot-r: 0.5pt; --dot-pitch: 2.31pt;
  font-family: "PF Angsana", "Angsana New", "AngsanaUPC", "Sarabun", serif;
  color: #000; font-size: 14pt; line-height: var(--lh); font-weight: 400;
}
.pf-sheet { position: relative; width: 595.28pt; height: 841.89pt; margin: 0 auto 12px; background: #fff; overflow: hidden; box-shadow: 0 4px 24px rgba(13,27,42,.18); }
.pf-logo { position: absolute; left: 39.8pt; top: 33.4pt; width: 146.2pt; height: 51.8pt; object-fit: contain; }
.pf-title { position: absolute; left: 57.6pt; width: 480.4pt; top: 76.5pt; margin: 0; text-align: center; font-size: 16pt; font-weight: 700; line-height: 24pt; }
/* The app's base layer gives headings / cells their own fonts — the form uses one. */
.pf-doc h1, .pf-doc h2, .pf-doc h3, .pf-doc li, .pf-doc td, .pf-doc th { font-family: inherit; }
.pf-body { position: absolute; left: 57.6pt; top: 114.95pt; width: 480.4pt; }
.pf-b { font-weight: 700; }
.pf-line { margin: 0; line-height: var(--lh); }
.pf-row { display: flex; height: var(--lh); white-space: nowrap; max-width: 480.4pt; }
.pf-row.pf-wrapped { height: auto; align-items: flex-start; }
.pf-l { flex: none; white-space: pre; }
.pf-v, .pf-ruled {
  background-image: radial-gradient(circle at 50% var(--dot-y), #000 var(--dot-r), transparent calc(var(--dot-r) + 0.15pt));
  background-size: var(--dot-pitch) var(--lh); background-repeat: repeat;
}
.pf-v { position: relative; min-width: 0; height: var(--lh); overflow: hidden; white-space: nowrap; text-align: left; padding-left: 1pt; }
.pf-v.pf-wrapped { white-space: normal; overflow: visible; height: auto; }
.pf-sigslot { flex: 0 0 80pt; overflow: visible; }
.pf-msig { position: absolute; left: 4pt; bottom: 5.4pt; max-height: 17pt; max-width: 72pt; object-fit: contain; mix-blend-mode: multiply; }
.pf-ruled { position: relative; overflow: hidden; }
.pf-ruled.pf-wrapped { height: auto !important; overflow: visible; }
.pf-ruled-text { line-height: var(--lh); word-break: break-word; }
.pf-l-inline { display: inline-block; background: #fff; height: var(--lh); vertical-align: top; padding-right: 0.5pt; }
.pf-travel { display: flex; align-items: center; white-space: nowrap; gap: 0 13pt; }
.pf-opt { display: inline-flex; align-items: center; gap: 3pt; }
.pf-mark { flex: none; position: relative; top: -0.4pt; }
.pf-members-head { text-indent: 32.4pt; }
.pf-note { margin-top: 9.48pt; }
.pf-signs { display: grid; grid-template-columns: 155.8pt 170.1pt 155.9pt; width: 482.3pt; height: 81.6pt; margin-top: 8.67pt; border: 0.5pt solid #000; box-sizing: border-box; }
.pf-sign { position: relative; border-left: 0.5pt solid #000; text-align: center; }
.pf-sign:first-child { border-left: 0; }
.pf-sign-head { position: absolute; left: 0; right: 0; top: 0.75pt; font-weight: 700; }
.pf-sign-img { position: absolute; left: 50%; bottom: 31.4pt; transform: translateX(-50%); max-height: 27pt; max-width: 130pt; object-fit: contain; mix-blend-mode: multiply; }
.pf-sign-dots { position: absolute; left: 50%; transform: translateX(-50%); top: 36.45pt; width: 116pt; height: var(--lh);
  background-image: radial-gradient(circle at 50% var(--dot-y), #000 var(--dot-r), transparent calc(var(--dot-r) + 0.15pt));
  background-size: var(--dot-pitch) var(--lh); background-repeat: repeat-x; }
.pf-sign-name { position: absolute; left: 2pt; right: 2pt; top: 55.25pt; white-space: nowrap; overflow: hidden; }
.pf-sign-date { position: absolute; left: 2pt; right: 2pt; top: 71.4pt; font-size: 9pt; line-height: 9pt; white-space: nowrap; }
.pf-hr { --lh: 16.4pt; --dot-y: 10pt; --dot-r: 0.45pt; --dot-pitch: 1.98pt;
  width: 481.3pt; height: 115.7pt; margin-top: 11.2pt; border: 0.5pt solid #000; box-sizing: border-box;
  padding: 1pt 4pt 0 5.2pt; font-size: 12pt; line-height: var(--lh); }
.pf-hr-line { display: flex; align-items: center; gap: 2.5pt; height: var(--lh); white-space: nowrap; }
.pf-hr-line .pf-v { height: var(--lh); }
.pf-hr-gap { flex: 0 0 34pt; }
.pf-foot { position: absolute; left: 57.6pt; right: 57.3pt; bottom: 9pt; display: flex; justify-content: space-between; font-size: 9pt; line-height: 1.2; color: #777; }
.pf-watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; font-size: 72pt; font-weight: 700; color: rgba(220, 38, 38, 0.13); transform: rotate(-32deg); white-space: nowrap; z-index: 5; }
.pf-p2 { position: absolute; left: 57.6pt; top: 46.15pt; width: 480.4pt; }
.pf-p2 p { margin: 0; }
.pf-reg-heading { margin-top: var(--lh) !important; }
.pf-reg-bullet { padding-left: 38.3pt; text-indent: -20.3pt; }
.pf-reg-dot { display: inline-block; width: 10pt; text-indent: 0; }
@media print {
  html, body { background: #fff !important; margin: 0 !important; }
  .pf-screen { background: #fff; padding: 0; min-height: 0; }
  .pf-sheet { margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
  .pf-sheet:last-child { break-after: auto; page-break-after: auto; }
  .no-print, button[aria-label="Back to top"] { display: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
