#!/usr/bin/env node
/**
 * Signatures: Employee.signatureDataUrl (legacy, leave screens) ➜ EmployeeSignature
 * (the one store since round 18; read/written only through /api/signature).
 *
 * Usage (from the repo root; the app's env lives in .env):
 *   node --env-file=.env scripts/migrate-signatures.mjs                      # DRY-RUN (default, read-only)
 *   node --env-file=.env scripts/migrate-signatures.mjs --apply              # copies the "copy" bucket
 *   node --env-file=.env scripts/migrate-signatures.mjs --apply --only-employee <id>   # one employee (tests)
 *
 * Every employee with a non-empty signatureDataUrl lands in exactly one bucket:
 *   copy        no EmployeeSignature row → would copy it in (as a PNG within
 *               400×160 and 60 KB, the OS-1 limits; shrunk only if larger)
 *   identical   an EmployeeSignature row with the same image → nothing to do
 *   differs     an EmployeeSignature row with a different image → KEPT as is
 *               (EmployeeSignature is the newer system); listed, nothing copied
 *   unusable    not an image data URL, or still over 60 KB after shrinking →
 *               listed, nothing copied
 *
 * Never modifies or deletes Employee.signatureDataUrl (it stays as a backup,
 * unread) and never overwrites an existing EmployeeSignature: --apply inserts
 * with $setOnInsert only, so re-running changes nothing. Uses the raw
 * collections, so no app model is loaded and no index is built.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const onlyIdx = process.argv.indexOf("--only-employee");
const ONLY = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null;
const { MONGODB_URI, MONGODB_DB } = process.env;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/migrate-signatures.mjs");
  process.exit(1);
}
if (ONLY && !mongoose.isValidObjectId(ONLY)) {
  console.error("--only-employee needs an employee _id");
  process.exit(1);
}

const MAX_W = 400;
const MAX_H = 160;
const MAX_BYTES = 60 * 1024;
const DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/;

function redactedHost(uri) {
  try {
    return new URL(uri).host;
  } catch {
    return "(unparseable URI)";
  }
}

/** PNG width/height from the IHDR chunk, or null. */
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

let sharpMod = null;
async function loadSharp() {
  if (sharpMod === null) sharpMod = (await import("sharp").catch(() => ({ default: false }))).default;
  return sharpMod;
}

/**
 * A PNG data URL within the OS-1 limits, or { error }. Already-small PNGs are
 * kept byte for byte; anything else is re-encoded (fit inside 400×160, white
 * background) with sharp.
 */
async function normalize(dataUrl) {
  const m = typeof dataUrl === "string" ? dataUrl.match(DATA_URL_RE) : null;
  if (!m) return { error: "not an image data URL" };
  const buf = Buffer.from(m[2], "base64");
  const size = m[1] === "png" ? pngSize(buf) : null;
  if (size && size.w <= MAX_W && size.h <= MAX_H && buf.length <= MAX_BYTES) return { png: dataUrl, shrunk: false };

  const sharp = await loadSharp();
  if (!sharp) return { error: "needs shrinking but sharp is not available" };
  const out = await sharp(buf)
    .resize({ width: MAX_W, height: MAX_H, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  if (out.length > MAX_BYTES) return { error: `still ${Math.round(out.length / 1024)} KB after shrinking` };
  return { png: `data:image/png;base64,${out.toString("base64")}`, shrunk: true };
}

async function main() {
  console.log(`mode: ${APPLY ? "APPLY (copies the copy bucket)" : "DRY-RUN (read-only)"}${ONLY ? ` — only employee ${ONLY}` : ""}`);
  console.log(`db:   ${redactedHost(MONGODB_URI)} / ${MONGODB_DB || "(db from URI)"}`);
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB, autoIndex: false });
  const db = mongoose.connection.db;

  const filter = { signatureDataUrl: { $type: "string", $ne: "" } };
  if (ONLY) filter._id = new mongoose.Types.ObjectId(ONLY);
  const emps = await db
    .collection("employees")
    .find(filter, { projection: { signatureDataUrl: 1, empAutoId: 1 } })
    .toArray();
  const sigs = await db
    .collection("employeesignatures")
    .find({ employee: { $in: emps.map((e) => e._id) } }, { projection: { employee: 1, png: 1 } })
    .toArray();
  const sigByEmp = new Map(sigs.map((s) => [String(s.employee), s.png]));

  const buckets = { copy: [], identical: [], differs: [], unusable: [] };
  for (const e of emps) {
    const label = `${e._id} (empAutoId ${e.empAutoId ?? "-"})`;
    const existing = sigByEmp.get(String(e._id));
    if (existing !== undefined) {
      (existing === e.signatureDataUrl ? buckets.identical : buckets.differs).push({ e, label });
      continue;
    }
    const n = await normalize(e.signatureDataUrl);
    if (n.error) buckets.unusable.push({ e, label, why: n.error });
    else buckets.copy.push({ e, label, png: n.png, shrunk: n.shrunk });
  }

  console.log(`employees with signatureDataUrl: ${emps.length}`);
  for (const [name, rows] of Object.entries(buckets)) {
    console.log(`  ${name.padEnd(9)} ${rows.length}`);
    for (const r of rows) console.log(`    - ${r.label}${r.shrunk ? " [shrunk]" : ""}${r.why ? ` — ${r.why}` : ""}`);
  }

  if (!APPLY) {
    console.log("dry-run: nothing written.");
  } else {
    let inserted = 0;
    let alreadyThere = 0;
    const now = new Date();
    for (const r of buckets.copy) {
      const res = await db
        .collection("employeesignatures")
        .updateOne(
          { employee: r.e._id },
          { $setOnInsert: { employee: r.e._id, png: r.png, createdAt: now, updatedAt: now } },
          { upsert: true }
        );
      if (res.upsertedCount) inserted += 1;
      else alreadyThere += 1; // created meanwhile — left untouched
    }
    console.log(`applied: inserted ${inserted}, left untouched (appeared meanwhile) ${alreadyThere}. Employee.signatureDataUrl not modified.`);
  }
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("migration failed:", e?.message || e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
