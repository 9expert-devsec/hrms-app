#!/usr/bin/env node
/**
 * Leave approvers from HR's sheet → Employee.leaveApprover1Id / leaveApprover2Id.
 *
 * Usage (from the repo root; the app's env lives in .env):
 *   node --env-file=.env scripts/import-leave-approvers.mjs            # DRY-RUN (default, read-only)
 *   node --env-file=.env scripts/import-leave-approvers.mjs --apply    # writes, only if the plan matches EXPECTED
 *
 * Employees are matched by Employee id: the ids round 38 recorded in
 * tmp/r38_survey.out (lines "EMP<TAB>id<TAB>empNo<TAB>English name<TAB>…"),
 * keyed by English name; without that file, by the English name in the DB
 * (trimmed, case-insensitive). Each id is re-checked against the DB.
 * Approvers are matched by their Thai name as written in the sheet
 * (firstNameTh + lastNameTh, exact).
 *
 * Same person in both columns = approver 1 only (lib/leaveRules.js
 * normalizeApprovers). The planned table must equal EXPECTED exactly, or
 * nothing is written.
 */
import { existsSync, readFileSync } from "node:fs";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const SURVEY = "tmp/r38_survey.out";

// HR's sheet. `en` = the employee's English name in the DB (round 38 match;
// the sheet spells #22 "Supakan Pernsamut", the DB "Supakan Poensamut" — the
// Thai name ศุภกานต์ เปิ้นสมุทร is identical). Approvers in Thai as in the sheet.
const SHEET = [
  { en: "Chalaivate Pipatpannawong", a1: null, a2: null },
  { en: "Kaenchai Pipatpannawong", a1: null, a2: null },
  { en: "Natnaree Srichaya", a1: "สิรินทรา นราศรี", a2: "สิรินทรา นราศรี" },
  { en: "Narakorn Peampatom", a1: "สิรินทรา นราศรี", a2: "สิรินทรา นราศรี" },
  { en: "Jintana Panatang", a1: "ณัฐนรี ศรีชญา", a2: "สิรินทรา นราศรี" },
  { en: "Phannarai Phutthi", a1: "ณัฐนรี ศรีชญา", a2: "สิรินทรา นราศรี" },
  { en: "Benchawan Kaewket", a1: "ณัฐนรี ศรีชญา", a2: "สิรินทรา นราศรี" },
  { en: "Saksit Jongjaiman", a1: "พรชนม์ ตันวัฒนะ", a2: "ชไลเวท พิพัฒพรรณวงศ์" },
  { en: "Kunyanat Maneevong", a1: "แก่นใจ พิพัฒพรรณวงศ์", a2: "แก่นใจ พิพัฒพรรณวงศ์" },
  { en: "Kritsada Sangdontree", a1: "นรากร เปี่ยมปฐม", a2: "สิรินทรา นราศรี" },
  { en: "Phupha Pattamasirikul", a1: "พรชนม์ ตันวัฒนะ", a2: "พรชนม์ ตันวัฒนะ" },
  { en: "Thananya Subtaweekul", a1: "กัญญณัช มณีวงศ์", a2: "กัญญณัช มณีวงศ์" },
  { en: "Pornchon Tanwattana", a1: "ชไลเวท พิพัฒพรรณวงศ์", a2: "ชไลเวท พิพัฒพรรณวงศ์" },
  { en: "Mone Silapheth", a1: "มนทิรา รอบคอบ", a2: "มนทิรา รอบคอบ" },
  { en: "Yanisa Pongmetha", a1: "พรชนม์ ตันวัฒนะ", a2: "พรชนม์ ตันวัฒนะ" },
  { en: "Sirinthra Narasri", a1: "ชไลเวท พิพัฒพรรณวงศ์", a2: "ชไลเวท พิพัฒพรรณวงศ์" },
  { en: "Chennarong Na-udon", a1: "พรชนม์ ตันวัฒนะ", a2: "พรชนม์ ตันวัฒนะ" },
  { en: "Pavin Komanasin", a1: "พรชนม์ ตันวัฒนะ", a2: "พรชนม์ ตันวัฒนะ" },
  { en: "Chuleephon In-unchot", a1: "พรชนม์ ตันวัฒนะ", a2: "พรชนม์ ตันวัฒนะ" },
  { en: "Pirasak Sungsuwan", a1: "พรชนม์ ตันวัฒนะ", a2: "พรชนม์ ตันวัฒนะ" },
  { en: "Monthira Robkob", a1: "แก่นใจ พิพัฒพรรณวงศ์", a2: "แก่นใจ พิพัฒพรรณวงศ์" },
  { en: "Supakan Poensamut", a1: "พรชนม์ ตันวัฒนะ", a2: "พรชนม์ ตันวัฒนะ" },
  { en: "Yanapa Sonporm", a1: "ณัฐนรี ศรีชญา", a2: "สิรินทรา นราศรี" },
  { en: "Samai Sanchan", a1: "มนทิรา รอบคอบ", a2: "มนทิรา รอบคอบ" },
];

// The expected result (round 39 brief), by Thai first name of the approvers.
const EXPECTED = {
  "Chalaivate Pipatpannawong": [], "Kaenchai Pipatpannawong": [],
  "Natnaree Srichaya": ["สิรินทรา"], "Narakorn Peampatom": ["สิรินทรา"],
  "Jintana Panatang": ["ณัฐนรี", "สิรินทรา"], "Phannarai Phutthi": ["ณัฐนรี", "สิรินทรา"],
  "Benchawan Kaewket": ["ณัฐนรี", "สิรินทรา"], "Yanapa Sonporm": ["ณัฐนรี", "สิรินทรา"],
  "Saksit Jongjaiman": ["พรชนม์", "ชไลเวท"],
  "Kunyanat Maneevong": ["แก่นใจ"], "Monthira Robkob": ["แก่นใจ"],
  "Kritsada Sangdontree": ["นรากร", "สิรินทรา"],
  "Thananya Subtaweekul": ["กัญญณัช"],
  "Pornchon Tanwattana": ["ชไลเวท"], "Sirinthra Narasri": ["ชไลเวท"],
  "Mone Silapheth": ["มนทิรา"], "Samai Sanchan": ["มนทิรา"],
  "Phupha Pattamasirikul": ["พรชนม์"], "Yanisa Pongmetha": ["พรชนม์"], "Chennarong Na-udon": ["พรชนม์"],
  "Pavin Komanasin": ["พรชนม์"], "Chuleephon In-unchot": ["พรชนม์"], "Pirasak Sungsuwan": ["พรชนม์"],
  "Supakan Poensamut": ["พรชนม์"],
};

const key = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB, autoIndex: false });
const db = mongoose.connection.db;
const Employees = db.collection("employees");
const all = await Employees.find({}).project({ firstName: 1, lastName: 1, firstNameTh: 1, lastNameTh: 1, userId: 1 }).toArray();
const byId = new Map(all.map((e) => [String(e._id), e]));
const enOf = (e) => key(`${e.firstName || ""} ${e.lastName || ""}`);
const thOf = (e) => `${(e.firstNameTh || "").trim()} ${(e.lastNameTh || "").trim()}`.trim();

// Employee ids: round 38's survey file, else the DB by English name.
const idByEn = new Map();
let source;
if (existsSync(SURVEY)) {
  source = SURVEY;
  for (const line of readFileSync(SURVEY, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const [tag, id, , en] = line.split("\t");
    if (tag === "EMP" && id && en) idByEn.set(key(en), id);
  }
} else {
  source = "database (English name)";
  for (const e of all) idByEn.set(enOf(e), String(e._id));
}
console.log(`mode: ${APPLY ? "APPLY" : "DRY-RUN"} · employee ids from ${source} · ${all.length} employees in DB`);

const problems = [];
const byThai = (name) => {
  if (!name) return null;
  const hits = all.filter((e) => thOf(e) === name);
  if (hits.length !== 1) {
    problems.push(`approver "${name}": ${hits.length} matches`);
    return null;
  }
  return hits[0];
};

const plan = [];
for (const row of SHEET) {
  const id = idByEn.get(key(row.en));
  const emp = id ? byId.get(id) : null;
  if (!emp) problems.push(`employee "${row.en}": ${id ? `id ${id} not in DB` : "no id"}`);
  else if (enOf(emp) !== key(row.en)) problems.push(`employee "${row.en}": id ${id} is now "${enOf(emp)}"`);
  const a1 = byThai(row.a1);
  let a2 = byThai(row.a2);
  if (a1 && a2 && String(a1._id) === String(a2._id)) a2 = null; // same person = approver 1 only
  if (emp && [a1, a2].some((a) => a && String(a._id) === String(emp._id))) problems.push(`employee "${row.en}": approves themself`);
  plan.push({ row, emp, a1, a2 });
}

// Compare with EXPECTED.
const firstTh = (e) => (e ? (e.firstNameTh || "").trim() : null);
for (const p of plan) {
  const got = [firstTh(p.a1), firstTh(p.a2)].filter(Boolean);
  const want = EXPECTED[p.row.en];
  if (!want) problems.push(`"${p.row.en}" missing from EXPECTED`);
  else if (got.join("|") !== want.join("|")) problems.push(`"${p.row.en}": planned [${got.join(", ")}] ≠ expected [${want.join(", ")}]`);
}
if (Object.keys(EXPECTED).length !== SHEET.length) problems.push(`EXPECTED has ${Object.keys(EXPECTED).length} rows, sheet ${SHEET.length}`);
const covered = new Set(plan.filter((p) => p.emp).map((p) => String(p.emp._id)));
if (covered.size !== all.length) problems.push(`sheet covers ${covered.size} of ${all.length} employees`);

const label = (a1, a2) => (!a1 ? "อนุมัติอัตโนมัติ" : a2 ? "คนใดคนหนึ่งอนุมัติ" : "อนุมัติคนเดียว");
console.log("\n#  employee                      employee id                approver 1                 approver 2                 mode");
plan.forEach((p, i) =>
  console.log(
    `${String(i + 1).padStart(2)} ${p.row.en.padEnd(29)} ${p.emp ? String(p.emp._id) : "—".padEnd(24)}  ${(p.a1 ? thOf(p.a1) : "—").padEnd(26)} ${(p.a2 ? thOf(p.a2) : "—").padEnd(26)} ${label(p.a1, p.a2)}`
  )
);
const counts = plan.reduce((c, p) => ((c[label(p.a1, p.a2)] = (c[label(p.a1, p.a2)] || 0) + 1), c), {});
console.log(`\ncounts: ${JSON.stringify(counts)}`);

const userIds = all.map((e) => e.userId).filter(Boolean);
const users = new Set((await db.collection("users").find({ _id: { $in: userIds } }).project({ _id: 1 }).toArray()).map((u) => String(u._id)));
const approvers = new Map();
for (const p of plan) for (const a of [p.a1, p.a2]) if (a) approvers.set(String(a._id), a);
const noAccount = [...approvers.values()].filter((a) => !a.userId || !users.has(String(a.userId)));
console.log(`approvers: ${approvers.size} · without a user account: ${noAccount.length ? noAccount.map(thOf).join(", ") : "none"}`);

if (problems.length) {
  console.log(`\nDIFFERENCES — nothing written:\n  - ${problems.join("\n  - ")}`);
  await mongoose.disconnect();
  process.exit(1);
}
console.log("\nplan matches EXPECTED exactly.");

if (APPLY) {
  for (const p of plan) {
    await Employees.updateOne({ _id: p.emp._id }, { $set: { leaveApprover1Id: p.a1 ? p.a1._id : null, leaveApprover2Id: p.a2 ? p.a2._id : null } });
  }
  const stored = await Employees.find({ _id: { $in: plan.map((p) => p.emp._id) } }).project({ firstName: 1, lastName: 1, leaveApprover1Id: 1, leaveApprover2Id: 1 }).toArray();
  const storedById = new Map(stored.map((e) => [String(e._id), e]));
  let ok = 0;
  console.log("\nstored values:");
  for (const p of plan) {
    const s = storedById.get(String(p.emp._id));
    const a1 = s.leaveApprover1Id ? thOf(byId.get(String(s.leaveApprover1Id))) : "—";
    const a2 = s.leaveApprover2Id ? thOf(byId.get(String(s.leaveApprover2Id))) : "—";
    const match = String(s.leaveApprover1Id || "") === String(p.a1?._id || "") && String(s.leaveApprover2Id || "") === String(p.a2?._id || "");
    if (match) ok += 1;
    console.log(`  ${match ? "OK " : "ERR"} ${p.row.en.padEnd(29)} ${a1.padEnd(26)} ${a2}`);
  }
  console.log(`applied: ${plan.length} employees updated · ${ok}/${plan.length} stored values match the plan`);
} else {
  console.log("DRY-RUN — nothing written. Re-run with --apply to write.");
}
await mongoose.disconnect();
