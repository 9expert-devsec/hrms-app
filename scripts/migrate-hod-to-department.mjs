#!/usr/bin/env node
/**
 * HOD consolidation: DepartmentHead (departmentCode → User) ➜ Department.headOfDepartment (→ Employee)
 *
 * Usage (from the repo root; the app's env lives in .env):
 *   node --env-file=.env scripts/migrate-hod-to-department.mjs           # DRY-RUN (default, read-only)
 *   node --env-file=.env scripts/migrate-hod-to-department.mjs --apply   # writes ok-set rows only
 *
 * DRY-RUN reads only. Every DepartmentHead row lands in exactly one bucket:
 *   ok-set          Department + Employee found, headOfDepartment empty → would set it
 *   already-same    headOfDepartment already is that Employee
 *   conflict        headOfDepartment is a DIFFERENT Employee
 *   no-department   no Department with that code (a case-insensitive hit is noted)
 *   no-employee     no Employee whose userId is that User
 *   multi-employee  more than one Employee has that userId
 * plus the reverse check `dept-only`: Departments with headOfDepartment set
 * but no DepartmentHead row (nothing is lost by the switch).
 * Summary on stdout; full CSV at tmp/hod-migration-dryrun-<timestamp>.csv.
 *
 * --apply: backs up every Department it will touch to
 * tmp/hod-backup-<timestamp>.json, then sets headOfDepartment for ok-set rows
 * only, and only where it is still empty (re-running changes nothing). It
 * never modifies or deletes the DepartmentHead collection.
 *
 * Uses the raw collections (departments, departmentheads, employees, users)
 * so no app model is loaded and no index is built.
 */
import mongoose from "mongoose";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const { MONGODB_URI, MONGODB_DB } = process.env;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/migrate-hod-to-department.mjs");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const TMP = "tmp";

const str = (v) => (v == null ? "" : String(v));
const fullName = (e) => [e?.firstName, e?.lastName].filter(Boolean).join(" ");
const describeEmp = (e) => (e ? `${fullName(e) || "(no name)"} [${str(e.empAutoId) || "no empAutoId"}]` : "(not found)");

function redactedHost(uri) {
  try {
    return new URL(uri).host;
  } catch {
    return "(unparseable URI)";
  }
}

function csvCell(v) {
  const s = str(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  console.log(`mode: ${APPLY ? "APPLY (writes ok-set rows)" : "DRY-RUN (read-only)"}`);
  console.log(`db:   ${redactedHost(MONGODB_URI)} / ${MONGODB_DB || "(db from URI)"}`);

  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB, autoIndex: false });
  const db = mongoose.connection.db;

  const [departments, heads, employees] = await Promise.all([
    db.collection("departments").find({}, { projection: { code: 1, name: 1, headOfDepartment: 1 } }).toArray(),
    db.collection("departmentheads").find({}).toArray(),
    db
      .collection("employees")
      .find({}, { projection: { firstName: 1, lastName: 1, empAutoId: 1, userId: 1, department: 1 } })
      .toArray(),
  ]);
  const userIds = [...new Set(heads.map((h) => str(h.userId)).filter(Boolean))];
  const users = await db
    .collection("users")
    .find(
      { _id: { $in: userIds.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id)) } },
      { projection: { email: 1, name: 1 } }
    )
    .toArray();

  const empById = new Map(employees.map((e) => [str(e._id), e]));
  const empsByUser = new Map();
  for (const e of employees) {
    if (!e.userId) continue;
    const k = str(e.userId);
    if (!empsByUser.has(k)) empsByUser.set(k, []);
    empsByUser.get(k).push(e);
  }
  const userById = new Map(users.map((u) => [str(u._id), u]));
  const deptByCode = new Map(departments.map((d) => [str(d.code), d]));

  const rows = [];
  for (const h of heads) {
    const code = str(h.departmentCode);
    const u = userById.get(str(h.userId));
    const base = {
      departmentCode: code,
      dhUserId: str(h.userId),
      userEmail: u?.email ?? "",
      userName: u?.name ?? "",
    };

    const dept = deptByCode.get(code);
    if (!dept) {
      const ci = departments.filter((d) => str(d.code).toLowerCase() === code.toLowerCase());
      rows.push({
        bucket: "no-department",
        ...base,
        note: ci.length
          ? `case-insensitive match only: ${ci.map((d) => `${d.code} (${d._id})`).join(", ")}`
          : "no department with this code",
      });
      continue;
    }

    const deptCols = { departmentId: str(dept._id), departmentName: dept.name ?? "" };
    const current = dept.headOfDepartment ? empById.get(str(dept.headOfDepartment)) : null;
    const currentCols = {
      currentHeadId: str(dept.headOfDepartment),
      currentHead: dept.headOfDepartment ? describeEmp(current) : "",
    };

    const matches = empsByUser.get(str(h.userId)) ?? [];
    if (matches.length === 0) {
      rows.push({
        bucket: "no-employee",
        ...base,
        ...deptCols,
        ...currentCols,
        note: u ? `user ${u.email} (${u.name || "no name"}) has no Employee` : "user not found either",
      });
      continue;
    }
    if (matches.length > 1) {
      rows.push({
        bucket: "multi-employee",
        ...base,
        ...deptCols,
        ...currentCols,
        employeeId: matches.map((e) => str(e._id)).join(" | "),
        employee: matches.map(describeEmp).join(" | "),
        note: `${matches.length} employees share this userId`,
      });
      continue;
    }

    const emp = matches[0];
    const empCols = { employeeId: str(emp._id), employee: describeEmp(emp) };
    if (!dept.headOfDepartment) {
      rows.push({ bucket: "ok-set", ...base, ...deptCols, ...empCols, ...currentCols, note: "would set headOfDepartment" });
    } else if (str(dept.headOfDepartment) === str(emp._id)) {
      rows.push({ bucket: "already-same", ...base, ...deptCols, ...empCols, ...currentCols, note: "" });
    } else {
      rows.push({
        bucket: "conflict",
        ...base,
        ...deptCols,
        ...empCols,
        ...currentCols,
        note: `DepartmentHead says ${describeEmp(emp)}; Department says ${describeEmp(current)}`,
      });
    }
  }

  // Reverse check: Department has a head but no DepartmentHead row with its code.
  const dhCodes = new Set(heads.map((h) => str(h.departmentCode)));
  for (const d of departments) {
    if (!d.headOfDepartment || dhCodes.has(str(d.code))) continue;
    const cur = empById.get(str(d.headOfDepartment));
    rows.push({
      bucket: "dept-only",
      departmentCode: str(d.code),
      departmentId: str(d._id),
      departmentName: d.name ?? "",
      currentHeadId: str(d.headOfDepartment),
      currentHead: describeEmp(cur),
      note: "Department has a head with no DepartmentHead row (kept as is)",
    });
  }

  // ── output ─────────────────────────────────────────────────────
  const BUCKETS = ["ok-set", "already-same", "conflict", "no-department", "no-employee", "multi-employee", "dept-only"];
  console.log(`\nDepartmentHead rows: ${heads.length} | Departments: ${departments.length} | Employees with userId: ${empsByUser.size}`);
  console.log("bucket counts:");
  for (const b of BUCKETS) console.log(`  ${b.padEnd(15)} ${rows.filter((r) => r.bucket === b).length}`);

  for (const b of ["conflict", "no-department", "no-employee", "multi-employee", "dept-only"]) {
    const list = rows.filter((r) => r.bucket === b);
    if (!list.length) continue;
    console.log(`\n${b}:`);
    for (const r of list) console.log(`  [${r.departmentCode}] ${r.note}`);
  }

  mkdirSync(TMP, { recursive: true });
  const COLS = [
    "bucket", "departmentCode", "departmentName", "departmentId", "dhUserId", "userEmail", "userName",
    "employeeId", "employee", "currentHeadId", "currentHead", "note",
  ];
  const csvPath = join(TMP, `hod-migration-dryrun-${stamp}.csv`);
  writeFileSync(csvPath, [COLS.join(","), ...rows.map((r) => COLS.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n");
  console.log(`\nCSV: ${csvPath}`);

  if (!APPLY) {
    console.log("DRY-RUN: no database writes were made.");
    return;
  }

  // ── apply: ok-set rows only ────────────────────────────────────
  const toSet = rows.filter((r) => r.bucket === "ok-set");
  const ids = toSet.map((r) => new mongoose.Types.ObjectId(r.departmentId));
  const backup = await db.collection("departments").find({ _id: { $in: ids } }).toArray();
  const backupPath = join(TMP, `hod-backup-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nbackup of ${backup.length} department(s): ${backupPath}`);

  let changed = 0;
  for (const r of toSet) {
    // Only where still empty (null or missing): idempotent, never overwrites.
    const res = await db.collection("departments").updateOne(
      { _id: new mongoose.Types.ObjectId(r.departmentId), headOfDepartment: null },
      { $set: { headOfDepartment: new mongoose.Types.ObjectId(r.employeeId) } }
    );
    changed += res.modifiedCount;
    console.log(`  ${r.departmentCode}: ${res.modifiedCount ? "set" : "unchanged"} → ${r.employee}`);
  }
  const skipped = rows.filter((r) => r.bucket !== "ok-set" && r.bucket !== "dept-only");
  console.log(`APPLY: ${changed} department(s) updated; ${skipped.length} DepartmentHead row(s) skipped:`);
  for (const r of skipped) console.log(`  [${r.bucket}] ${r.departmentCode}`);
  console.log("DepartmentHead collection left untouched.");
}

main()
  .catch((err) => {
    console.error("migration failed:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
