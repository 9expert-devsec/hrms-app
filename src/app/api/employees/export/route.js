// src/app/api/employees/export/route.js
// ส่งออก Excel — the rows ข้อมูลพนักงาน shows for the same filters, same order.
import ExcelJS from "exceljs";
import { requirePageApi } from "@/lib/rbac/guard";
import dbConnect from "@/lib/mongoose";
import { loadEmployeeDirectory } from "@/lib/employeeDirectory";
import { readFilters, rowMatches } from "@/lib/employeeDirectoryFilter";

export const dynamic = "force-dynamic";

const ACCOUNT_LABEL = { active: "ใช้งาน", suspended: "ระงับ", none: "ไม่มีบัญชี" };

// Only these columns — never bank, address, birthday, ID card, emergency contact or salary.
const COLUMNS = [
  { header: "รหัสพนักงาน", key: "code", width: 14, text: true },
  { header: "คำนำหน้า", key: "titleTh", width: 11 },
  { header: "ชื่อ (ไทย)", key: "firstNameTh", width: 18 },
  { header: "นามสกุล (ไทย)", key: "lastNameTh", width: 20 },
  { header: "ชื่อ-นามสกุล (อังกฤษ)", key: "nameEn", width: 28 },
  { header: "ชื่อเล่น", key: "nickName", width: 12 },
  { header: "แผนก", key: "deptName", width: 26 },
  { header: "ตำแหน่ง", key: "position", width: 26 },
  { header: "เบอร์โทร", key: "phone", width: 16, text: true },
  { header: "อีเมล", key: "email", width: 32 },
  { header: "สถานะบัญชี", key: "account", width: 13 },
];

function bangkokDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
}

export async function GET(req) {
  const gate = await requirePageApi("employees");
  if (gate.res) return gate.res;

  await dbConnect();
  const filters = readFilters(new URL(req.url).searchParams);
  const { groups } = await loadEmployeeDirectory();
  const rows = groups.flatMap((g) => g.rows).filter((r) => rowMatches(r, filters));

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet("พนักงาน", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map(({ header, key, width }) => ({ header, key, width }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({ ...r, deptName: r.deptName, account: ACCOUNT_LABEL[r.accountStatus] || ACCOUNT_LABEL.none });
  }
  // Codes and phones as text, so leading zeros survive.
  COLUMNS.forEach((c, i) => {
    if (c.text) ws.getColumn(i + 1).numFmt = "@";
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `พนักงาน-${bangkokDate()}.xlsx`;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="employees-${bangkokDate()}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
