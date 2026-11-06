/* eslint-disable @next/next/no-img-element */
/**
 * "แบบฟอร์มการเบิกเบี้ยเลี้ยงการทำงานนอกสถานที่" — the printable form, built on
 * the measurements of the official Word original (Rev.5, 1 June 2026; A4
 * 595.3 × 841.9 pt): Angsana New (installed on the machine — never bundled),
 * pt metrics, typed-dot leaders. Page 1 the form, then as many continuation
 * sheets as the members need, last the regulations (lib/offsiteRegulations.js).
 * Server-renderable (no hooks): every member is rendered on page 1 with a
 * hidden continuation sheet beside it; once fonts and signatures are ready
 * PrintFit moves the rows that do not fit onto copies of that sheet, and
 * shrinks fill-in values that do not fit their dots. Printing is the
 * browser's (PrintButton).
 *
 * Baselines in the original (pt from the top): title 93.0; "ข้าพเจ้า" 127.7,
 * then one line every 18.92 pt (the original's 10 member lines end at 543.8;
 * the member table keeps that block, so what follows stays put); หมายเหตุ 572.2 (+9.5);
 * signature table 606.1–687.7; HR box from 698.9 (pitch 16.4).
 * In Chromium with Angsana New, a 14-pt baseline sits 12.75 pt below the top
 * of an 18.92-pt line box, 16 pt bold 16.5 pt in 24 pt, 12 pt 10.5 pt in 16.4 pt.
 *
 * Horizontally every line is a row of fixed tab stops (`Stops`): x values are
 * the original's, in pt from the page's left edge. A fill-in (`S`) is a dotted
 * segment; a value replaces the dots (3-pt gap, the value, 3-pt gap, dots to
 * the segment's end) so no dot ever runs under the text.
 */
import { Children, cloneElement } from "react";
import { SELF_APPROVAL_LABEL, TRAVEL_MODES, formatBaht, formatDateLongTh, normalizeTravelModes, workDateParts } from "@/lib/offsiteRules";
import { OFFSITE_REGULATIONS } from "@/lib/offsiteRegulations";

const BODY_X = 57.6; // page x of the text block's left edge (Word's left margin)
const HR_X = 58.1; // page x inside the HR box's 0.5-pt border
// Member table columns, in % of its width (the approval table's).
const MEMBER_COLUMNS = [
  { title: "ลำดับ", width: "8%" },
  { title: "ชื่อ-นามสกุล", width: "27%" },
  { title: "หน้าที่ / ตำแหน่ง", width: "41%" },
  { title: "ลายเซ็น", width: "24%" },
];

// Wording of the paper form (the app's own labels are shorter).
const TRAVEL_LABELS = {
  self_from_company: "เดินทางเองจากบริษัทฯ",
  company_van: "เดินทางโดยรถตู้บริษัทฯ",
  from_lodging: "เดินทางจากที่พัก",
};
// Box (Wingdings 2 in the original) and label x of each travel option.
const TRAVEL_STOPS = [
  { box: 153.5, label: 168.3 },
  { box: 273.6, label: 288.4 },
  { box: 417.7, label: 432.5 },
];
// `dots` = width of the centred signature dots in each cell.
const SIGN_COLUMNS = [
  { step: 1, title: "หัวหน้าแผนก/ ผู้รับผิดชอบ", dots: 122.5 },
  { step: 2, title: "ผู้ตรวจสอบ", dots: 131.6 },
  { step: 3, title: "ฝ่ายบุคคล", dots: 124.7 },
];

// Leaders are typed periods, like Word's: rendered long and clipped, then trimmed to whole dots by PrintFit.
const DOT_FILL = ".".repeat(240);

/** pt with at most 2 decimals. */
const pt = (n) => `${+n.toFixed(2)}pt`;

/** Times as written on the form: "09:00" → "09.00". */
const dotTime = (t) => String(t || "").replace(":", ".");

function Box({ checked }) {
  return (
    <svg width="10.1pt" height="10.1pt" viewBox="0 0 12 12" aria-hidden="true" className="pf-box">
      <rect x="0.5" y="0.5" width="11" height="11" fill="#fff" stroke="#000" strokeWidth="0.9" />
      {checked && <path d="M2.6 6.2 L5 8.7 L9.6 3.3" fill="none" stroke="#000" strokeWidth="1.4" />}
    </svg>
  );
}

function Radio({ checked }) {
  return (
    <svg width="9pt" height="9pt" viewBox="0 0 12 12" aria-hidden="true" className="pf-radio">
      <circle cx="6" cy="6" r="5.4" fill="#fff" stroke="#000" strokeWidth="0.9" />
      {checked && <circle cx="6" cy="6" r="3" fill="#000" />}
    </svg>
  );
}

/**
 * One line of fixed tab stops, like the Word original: each child starts at
 * page x `at` (pt) and, unless it is the last, ends at `to`. `base` = page x
 * of the container's left edge.
 */
function Stops({ base = BODY_X, children }) {
  let cursor = base;
  return (
    <div className="pf-row">
      {Children.toArray(children).map((child) => {
        const { at, to } = child.props;
        const style = { marginLeft: pt(at - cursor), ...(to != null && { flex: `0 0 ${pt(to - at)}` }) };
        cursor = to ?? at;
        return cloneElement(child, { style });
      })}
    </div>
  );
}

/** A label (or any fixed text) at a tab stop. */
const L = ({ children, style }) => (
  <span className="pf-l" style={style}>
    {children}
  </span>
);

/** A box / radio mark at a tab stop. */
const Icon = ({ children, style }) => (
  <span className="pf-icon" style={style}>
    {children}
  </span>
);

/**
 * A dotted fill-in from `at` to `to`. Empty: dots end to end. With a value:
 * 3-pt gap, the value, 3-pt gap, dots to the end — or, `center`ed, dots on
 * both sides of it. PrintFit shrinks a value that does not fit, then lets it
 * wrap.
 */
function S({ children, style, base = 14, center = false }) {
  const has = children != null && children !== "" && children !== false;
  return (
    <span className="pf-seg" style={style} data-fit="line" data-base-pt={base}>
      {has && center && <span className="pf-dots pf-dots-l">{DOT_FILL}</span>}
      {has && (
        <span className="pf-val">
          <span className="pf-vt">{children}</span>
        </span>
      )}
      <span className="pf-dots">{DOT_FILL}</span>
    </span>
  );
}

/**
 * A label and free text over `rows` dotted lines that end at page x `to`;
 * the first line's dots start where the label ends (`labelTo`).
 */
function RuledBlock({ label, labelTo, text, rows, to }) {
  return (
    <div className="pf-ruled" data-fit="block" data-base-pt="14" style={{ width: pt(to - BODY_X), height: `calc(${rows} * var(--lh))` }}>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="pf-ruled-dots" style={{ top: `calc(${i} * var(--lh))` }}>
          {DOT_FILL}
        </span>
      ))}
      <div className="pf-ruled-text">
        <span className="pf-l-inline" style={{ width: pt(labelTo - BODY_X) }}>
          {label}
        </span>
        {text ? <span className="pf-rv">{text}</span> : null}
      </div>
    </div>
  );
}

/** One member row. Long text wraps inside its cell; rows are never split (PrintFit moves them whole). */
function MemberRow({ n, m }) {
  return (
    <tr>
      <td className="pf-mno">{n}.</td>
      <td>{m.nameSnapshot}</td>
      <td>
        <div className="pf-duty">
          <span className="pf-duty-l">หน้าที่</span>
          <span className="pf-duty-v">{m.duty}</span>
        </div>
      </td>
      {/* Signed on the line: the dots run unbroken under the signature (placed by PrintFit). */}
      <td className="pf-msign">
        <span className="pf-sig-dots">{DOT_FILL}</span>
        {m.signature ? <img src={m.signature} alt="" className="pf-msig" data-sig="member" /> : null}
      </td>
    </tr>
  );
}

/** The bordered member table with its header row; the rows are `children`. */
function MemberTable({ children }) {
  return (
    <table className="pf-mtable">
      <colgroup>
        {MEMBER_COLUMNS.map(({ title, width }) => (
          <col key={title} style={{ width }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {MEMBER_COLUMNS.map(({ title }) => (
            <th key={title}>{title}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

/** The regulations page, line by line as the original breaks it. */
function Regulations() {
  const x = (at) => ({ left: pt(at - BODY_X) });
  return (
    <div className="pf-p2">
      {OFFSITE_REGULATIONS.lines.map((l, i) => {
        if (l === "") return <div key={i} className="pf-p2-line" />;
        if (l.heading)
          return (
            <div key={i} className="pf-p2-line pf-b">
              {l.heading}
            </div>
          );
        return (
          <div key={i} className="pf-p2-line">
            {l.mark && (
              <span className="pf-p2-at" style={x(l.markAt)}>
                {l.mark}
              </span>
            )}
            <span className="pf-p2-at" style={x(l.at)}>
              {l.note && <u>{l.note}</u>}
              {l.text}
            </span>
            {l.tab && (
              <span className="pf-p2-at" style={x(l.tab.at)}>
                {l.tab.text}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OffsitePrintForm({ r, printedAt }) {
  const date = workDateParts(r.workDate);
  const step = (n) => (r.approvals || []).find((a) => a.step === n) || {};
  const travel = normalizeTravelModes(r.travelMode);
  const hr = r.hrSummary || {};
  const watermark = r.status === "approved" ? null : r.status === "cancelled" ? "ยกเลิกแล้ว" : "ยังไม่อนุมัติ";
  const amountFor = (option) => (hr.allowanceOption === option && hr.amountPerPerson ? formatBaht(hr.amountPerPerson) : "");
  const sheetHead = (
    <>
      {watermark && (
        <div className="pf-watermark" aria-hidden="true">
          {watermark}
        </div>
      )}
      <img src="/brand/logo-blue-ink.png" alt="9Expert" className="pf-logo" />
      <div className="pf-docno">เลขที่ {r.docNo || "ยังไม่ออกเลข"}</div>
    </>
  );

  return (
    <div className="pf-doc" data-testid="offsite-print">
      {/* ── Page 1: the form ─────────────────────────────── */}
      <article className="pf-sheet">
        {sheetHead}
        <h1 className="pf-title">แบบฟอร์มการเบิกเบี้ยเลี้ยงการทำงานนอกสถานที่</h1>

        <div className="pf-body">
          <Stops>
            <L at={93} to={122.7}>
              ข้าพเจ้า
            </L>
            <S at={122.7} to={253.9} center>
              {r.creatorNameTh}
            </S>
            <L at={256.7} to={291.3}>
              ตำแหน่ง
            </L>
            <S at={291.3} to={524} center>
              {r.creatorPosition}
            </S>
          </Stops>
          <Stops>
            <L at={57.6} to={81.4}>
              แผนก
            </L>
            <S at={81.4} to={307.2} center>
              {r.creatorDepartment}
            </S>
          </Stops>
          <p className="pf-line">มีความประสงค์ขอเบิกเบี้ยเลี้ยงในการทำงานนอกสถานที่ โดยมีรายละเอียด ดังนี้</p>
          <Stops>
            <L at={57.6} to={84.8}>
              ชื่องาน
            </L>
            <S at={84.8} to={532.2}>
              {r.jobName}
            </S>
          </Stops>
          <Stops>
            <L at={57.6} to={87.4}>
              ในวันที่
            </L>
            <S at={87.4} to={126.2} center>
              {date.day}
            </S>
            <L at={128.9} to={148.9}>
              เดือน
            </L>
            <S at={148.9} to={194.6} center>
              {date.month}
            </S>
            <L at={197.3} to={216}>
              พ.ศ.
            </L>
            <S at={216} to={268.8} center>
              {date.yearBE}
            </S>
            <L at={271.7} to={311.8}>
              ตั้งแต่เวลา
            </L>
            <S at={311.8} to={373.5} center>
              {dotTime(r.startTime)}
            </S>
            <L at={373.5} to={385.1}>
              น.
            </L>
            <L at={385.1} to={411.9}>
              ถึงเวลา
            </L>
            <S at={411.9} to={464.5} center>
              {dotTime(r.endTime)}
            </S>
            <L at={464.5} to={476.1}>
              น.
            </L>
            <L at={476.1}>(โดยประมาณ)</L>
          </Stops>
          <RuledBlock label="อธิบายลักษณะงานโดยสังเขป" labelTo={168.3} text={r.description} rows={3} to={535.3} />
          <Stops>
            <L at={57.6} to={163.5}>
              ชื่อสถานที่ในการปฏิบัติงาน
            </L>
            <S at={163.5} to={537.6}>
              {r.placeName}
            </S>
          </Stops>
          <Stops>
            <L at={57.6} to={108.4}>
              ที่อยู่จุดหมาย
            </L>
            <S at={108.4} to={535.2}>
              {r.address}
            </S>
          </Stops>
          <Stops>
            <L at={57.6} to={TRAVEL_STOPS[0].box}>
              โดยการเดินทาง ดังนี้
            </L>
            {TRAVEL_MODES.flatMap((m, i) => [
              <Icon key={`b${m}`} at={TRAVEL_STOPS[i].box} to={TRAVEL_STOPS[i].label}>
                <Box checked={travel.includes(m)} />
              </Icon>,
              <L key={`l${m}`} at={TRAVEL_STOPS[i].label} to={TRAVEL_STOPS[i + 1]?.box}>
                {TRAVEL_LABELS[m]}
              </L>,
            ])}
          </Stops>
          <p className="pf-line pf-members-head">
            รายชื่อผู้ร่วมทำงาน{" "}
            <u>(กรณีทำงานที่เดียวกันหลายท่านให้ระบุทุกท่านพร้อมหน้าที่ที่รับผิดชอบในงานและเซ็นชื่อรับทราบด้วยตนเองทุกครั้ง)</u>
          </p>
          <div className="pf-members">
            <MemberTable>
              {r.members.map((m, i) => (
                <MemberRow key={i} n={i + 1} m={m} />
              ))}
            </MemberTable>
            <div className="pf-more" hidden>
              มีรายชื่อผู้ร่วมงานต่อในแผ่นถัดไป
            </div>
          </div>
          <div className="pf-note">
            <RuledBlock label="หมายเหตุ" labelTo={93.5} text={r.note} rows={2} to={537} />
          </div>

          <div className="pf-signs">
            {SIGN_COLUMNS.map(({ step: n, title, dots }) => {
              const a = step(n);
              const signed = a.status === "approved" || a.status === "needs_reconfirm";
              return (
                <div key={n} className="pf-sign">
                  <div className="pf-sign-head">{title}</div>
                  {signed && a.signature ? <img src={a.signature} alt="" className="pf-sign-img" data-sig="approval" /> : null}
                  <div className="pf-sign-dots" style={{ width: pt(dots), left: `calc(50% - ${pt(dots / 2)})` }}>
                    {DOT_FILL}
                  </div>
                  {signed ? (
                    <div className="pf-sign-name">( {a.approverName} )</div>
                  ) : (
                    <>
                      <span className="pf-sign-paren pf-sign-open">(</span>
                      <span className="pf-sign-paren pf-sign-close">)</span>
                    </>
                  )}
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
            <Stops base={HR_X}>
              <L at={63.3}>
                <b>
                  <u>สำหรับฝ่ายบุคคล</u>
                </b>
              </L>
            </Stops>
            <Stops base={HR_X}>
              <L at={63.3}>
                <b>สรุปการเบิกเบี้ยเลี้ยง</b>
              </L>
            </Stops>
            <Stops base={HR_X}>
              <Icon at={64.2} to={78}>
                <Radio checked={hr.allowanceOption === "per_person"} />
              </Icon>
              <L at={78} to={104.2}>
                เบี้ยเลี้ยง
              </L>
              <S at={104.2} to={141.8} base={12} center>
                {amountFor("per_person")}
              </S>
              <L at={141.9}>บาท/ ท่าน</L>
            </Stops>
            <Stops base={HR_X}>
              <Icon at={64.2} to={78}>
                <Radio checked={hr.allowanceOption === "per_person_plus_travel"} />
              </Icon>
              <L at={78} to={104.2}>
                เบี้ยเลี้ยง
              </L>
              <S at={104.2} to={141.8} base={12} center>
                {amountFor("per_person_plus_travel")}
              </S>
              <L at={141.9} to={178.4}>
                บาท/ ท่าน
              </L>
              <L at={178.4}>และค่าเดินทางตามจริง (กรณีไปทำงานมากกว่า 1 ที่)</L>
            </Stops>
            <Stops base={HR_X}>
              <Icon at={64.2} to={78}>
                <Radio checked={hr.allowanceOption === "travel_actual"} />
              </Icon>
              <L at={78}>ค่าเดินทางตามจริง</L>
            </Stops>
            <Stops base={HR_X}>
              <Icon at={64.2} to={78}>
                <Radio checked={hr.allowanceOption === "no_allowance"} />
              </Icon>
              <L at={78}>ไม่เบิกเบี้ยเลี้ยง</L>
            </Stops>
            <Stops base={HR_X}>
              <L at={63.3} to={94.5}>
                <b>หมายเหตุ</b>
              </L>
              <S at={94.5} to={532.3} base={12}>
                {hr.note}
              </S>
            </Stops>
          </section>
        </div>
      </article>

      {/* ── Continuation sheet: stays hidden; PrintFit copies it for the rows page 1 cannot hold ── */}
      <article className="pf-sheet" data-pf-cont-template hidden>
        {sheetHead}
        <h2 className="pf-title">รายชื่อผู้ร่วมงาน (ต่อ)</h2>
        <div className="pf-body">
          <MemberTable />
        </div>
      </article>

      {/* ── Last page: the regulations ───────────────────── */}
      <article className="pf-sheet">
        <Regulations />
        <div className="pf-printed">พิมพ์เมื่อ {printedAt}</div>
      </article>
    </div>
  );
}

/**
 * Exact A4 sheets in pt, positioned from the page edge (@page margin 0).
 * Font: Angsana New from the machine (local(); never bundled or served),
 * then AngsanaUPC, then the Sarabun / serif fallback.
 * Dots: typed periods in the form's font (2.31 pt apart at 14 pt, 1.98 at 12),
 * so they sit on the baseline like Word's. CSS gradients / blend modes are
 * avoided — Chrome prints them as faint shadings or flattens them to bitmaps.
 */
export const PRINT_CSS = `
@font-face { font-family: "PF Angsana"; src: local("Angsana New"), local("AngsanaNew"); font-weight: 400; font-style: normal; }
@font-face { font-family: "PF Angsana"; src: local("Angsana New Bold"), local("AngsanaNew-Bold"); font-weight: 700; font-style: normal; }
@page { size: A4 portrait; margin: 0; }
.pf-screen { background: #D1D5DB; min-height: 100dvh; padding: 16px 0 40px; }
.pf-toolbar { width: 595.28pt; max-width: calc(100vw - 32px); margin: 0 auto 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 14px; }
.pf-font-note { width: 595.28pt; max-width: calc(100vw - 32px); margin: 0 auto 12px; padding: 8px 12px; border-radius: 8px; background: #FEF3C7; color: #92400E; font-size: 13px; }
.pf-doc {
  --lh: 18.92pt;
  font-family: "PF Angsana", "Angsana New", "AngsanaUPC", "Sarabun", serif;
  color: #000; font-size: 14pt; line-height: var(--lh); font-weight: 400;
}
.pf-sheet { position: relative; width: 595.28pt; height: 841.89pt; margin: 0 auto 12px; background: #fff; overflow: hidden; box-shadow: 0 4px 24px rgba(13,27,42,.18); }
/* Phones: the preview is scaled to the screen width (PrintFit sets --pf-fit after measuring); print is always 100 %. */
@media screen { .pf-doc { zoom: var(--pf-fit, 1); } }
.pf-logo { position: absolute; left: 39.8pt; top: 33.4pt; width: 146.2pt; height: 51.8pt; object-fit: contain; }
.pf-docno, .pf-printed { position: absolute; right: 57.28pt; font-size: 9pt; line-height: 11pt; color: #777; white-space: nowrap; }
.pf-docno { top: 53.8pt; }
.pf-printed { bottom: 9pt; }
.pf-title { position: absolute; left: 57.6pt; width: 480.4pt; top: 76.5pt; margin: 0; text-align: center; font-size: 16pt; font-weight: 700; line-height: 24pt; }
/* The app's base layer gives headings / cells their own fonts — the form uses one. */
.pf-doc h1, .pf-doc h2, .pf-doc h3, .pf-doc li, .pf-doc td, .pf-doc th { font-family: inherit; }
.pf-body { position: absolute; left: 57.6pt; top: 114.95pt; width: 480.4pt; }
.pf-b { font-weight: 700; }
.pf-line { margin: 0; line-height: var(--lh); }
.pf-row { display: flex; height: var(--lh); white-space: nowrap; }
.pf-row.pf-wrapped { height: auto; align-items: flex-start; }
.pf-l { flex: none; min-width: 0; white-space: pre; }
.pf-icon { flex: none; min-width: 0; height: var(--lh); }
.pf-box { display: block; margin: 2.55pt 0 0 1.2pt; }
.pf-radio { display: block; margin: 1.6pt 0 0 -0.1pt; }
.pf-seg { display: flex; min-width: 0; height: var(--lh); overflow: hidden; white-space: nowrap; }
.pf-val { flex: none; padding: 0 3pt; }
.pf-dots, .pf-ruled-dots, .pf-sign-dots, .pf-sig-dots { overflow: hidden; white-space: nowrap; }
.pf-dots { flex: 1 1 0; min-width: 0; align-self: flex-end; height: var(--lh); }
/* Centred value: the left run hugs the value's 3-pt gap, the right run starts after it. */
.pf-dots-l { text-align: right; }
.pf-seg.pf-wrapped { height: auto; overflow: visible; white-space: normal; }
.pf-seg.pf-wrapped .pf-val { flex: 0 1 auto; min-width: 0; }
/*
 * Signatures sit ON the dotted line, over unbroken dots, in their stored
 * colours. PrintFit makes the background transparent, crops to the ink, sizes
 * it (printSignatures SIG_BOX) and sets its top so the ink rests on the dot
 * baseline; the CSS here is the fallback placement. Absolutely positioned
 * (never changes the line pitch), centred by auto margins (no transform), and
 * no mix-blend-mode / filter: Chrome prints those as flattened bitmaps.
 */
.pf-msig { position: absolute; left: 0; right: 0; margin: 0 auto; bottom: 3pt; max-width: 100pt; max-height: 13pt; }
.pf-ruled { position: relative; overflow: hidden; }
.pf-ruled.pf-wrapped { height: auto !important; overflow: visible; }
.pf-ruled-dots { position: absolute; left: 0; right: 0; height: var(--lh); }
.pf-ruled-text { position: relative; line-height: var(--lh); word-break: break-word; }
/* Label and value mask the ruled block's dots: none show under their glyphs. */
.pf-l-inline { display: inline-block; background: #fff; height: var(--lh); vertical-align: top; white-space: nowrap; }
.pf-rv { background: #fff; padding: 0 3pt; }
.pf-members-head { text-indent: 32.4pt; }
/* The original's 10 lines + the gap above หมายเหตุ: a short table leaves everything below where it was. */
.pf-members { min-height: calc(10 * var(--lh) + 9.48pt); }
/* Same weight as the approval table; no fills, no radius. The width is .pf-signs'. */
.pf-mtable { width: 482.3pt; table-layout: fixed; border-collapse: collapse; line-height: 16pt; }
.pf-mtable th, .pf-mtable td { height: 16pt; padding: 0 4pt; border: 0.5pt solid #000; border-radius: 0; background: none; color: #000; font-size: 14pt; font-weight: 400; line-height: 16pt; text-align: left; vertical-align: middle; overflow-wrap: anywhere; }
.pf-mtable th { font-weight: 700; text-align: center; }
.pf-mtable td.pf-mno { text-align: center; }
.pf-mtable td.pf-msign { position: relative; padding: 0; }
/* Hanging indent: wrapped duty lines stay under the duty text. */
.pf-duty { display: flex; gap: 3pt; }
.pf-duty-l { flex: none; }
.pf-duty-v { flex: 1 1 0; min-width: 0; }
.pf-sig-dots { position: absolute; left: 6pt; right: 6pt; bottom: 0; height: 14pt; line-height: 14pt; text-align: center; }
.pf-more { font-size: 12pt; line-height: 10pt; white-space: nowrap; }
.pf-signs { display: grid; grid-template-columns: 155.3pt 170.1pt 155.9pt; width: 482.3pt; height: 81.6pt; margin-top: 8.67pt; border: 0.5pt solid #000; box-sizing: border-box; }
.pf-sign { position: relative; border-left: 0.5pt solid #000; text-align: center; }
.pf-sign:first-child { border-left: 0; }
.pf-sign-head { position: absolute; left: 0; right: 0; top: 0.75pt; font-weight: 700; }
.pf-sign-img { position: absolute; left: 0; right: 0; margin: 0 auto; bottom: 30.4pt; max-height: 28pt; max-width: 140pt; }
/* Centred by its inline left (a transform would print the dots as a bitmap); drawn over the signature image. */
.pf-sign-dots { position: absolute; z-index: 1; top: 36.45pt; height: var(--lh); text-align: center; }
.pf-sign-name { position: absolute; left: 2pt; right: 2pt; top: 55.25pt; white-space: nowrap; overflow: hidden; }
.pf-sign-paren { position: absolute; top: 55.25pt; }
.pf-sign-open { left: 9pt; }
.pf-sign-close { left: calc(100% - 11pt); }
.pf-sign-date { position: absolute; left: 2pt; right: 2pt; top: 71.4pt; font-size: 9pt; line-height: 9pt; white-space: nowrap; }
.pf-hr { --lh: 16.4pt;
  width: 481.3pt; height: 132.1pt; margin-top: 11.2pt; border: 0.5pt solid #000; box-sizing: border-box;
  padding-top: 1pt; font-size: 12pt; line-height: var(--lh); }
.pf-watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; font-size: 72pt; font-weight: 700; color: rgba(220, 38, 38, 0.13); transform: rotate(-32deg); white-space: nowrap; z-index: 5; }
.pf-p2 { position: absolute; left: 57.6pt; top: 46.15pt; width: 480.4pt; }
.pf-p2-line { position: relative; height: var(--lh); white-space: pre; }
.pf-p2-at { position: absolute; top: 0; }
@media print {
  html, body { background: #fff !important; margin: 0 !important; }
  .pf-screen { background: #fff; padding: 0; min-height: 0; }
  .pf-sheet { margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
  .pf-sheet:last-child { break-after: auto; page-break-after: auto; }
  .no-print, button[aria-label="Back to top"] { display: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
