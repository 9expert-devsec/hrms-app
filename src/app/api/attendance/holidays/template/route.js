import { requirePageApi } from "@/lib/rbac/guard";

export async function GET(req) {
  const gate = await requirePageApi("holidays");
  if (gate.res) return gate.res;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || new Date().getFullYear();

  const headers = "date,name,type";
  const rows = [
    `${year}-01-01,วันขึ้นปีใหม่,public`,
    `${year}-04-06,วันจักรี,public`,
    `${year}-04-13,วันสงกรานต์,public`,
    `${year}-04-14,วันสงกรานต์,public`,
    `${year}-04-15,วันสงกรานต์,public`,
    `${year}-05-01,วันแรงงานแห่งชาติ,public`,
    `${year}-05-05,วันฉัตรมงคล,public`,
    `${year}-06-03,วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี,public`,
    `${year}-07-28,วันเฉลิมพระชนมพรรษารัชกาลที่ 10,public`,
    `${year}-08-12,วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนี,public`,
    `${year}-10-13,วันนวมินทรมหาราช,public`,
    `${year}-10-23,วันปิยมหาราช,public`,
    `${year}-12-05,วันเฉลิมพระชนมพรรษารัชกาลที่ 9,public`,
    `${year}-12-10,วันรัฐธรรมนูญ,public`,
    `${year}-12-31,วันสิ้นปี,public`,
    `# --- ตัวอย่างวันหยุดบริษัท (ลบ # ออกเพื่อใช้งาน) ---`,
    `#${year}-02-14,วันวาเลนไทน์ (วันหยุดพิเศษ),company`,
  ].join("\n");

  const bom = "\uFEFF";
  const csv = `${bom}${headers}\n${rows}`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="holidays-${year}-template.csv"`,
    },
  });
}
