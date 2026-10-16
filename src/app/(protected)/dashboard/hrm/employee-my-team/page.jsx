// src/app/(protected)/dashboard/hrm/employee-my-team/page.jsx
export const dynamic = "force-dynamic";

import dbConnect from "@/lib/mongoose";
import { requirePage } from "@/lib/rbac/guard";
import Department from "@/models/Department";
import Employee from "@/models/Employee";
import MyTeamClient from "./MyTeamClient";
import { employeeOfUser } from "@/lib/rbac/scopeQueries";
import { UnlinkedNotice } from "./../../../../../components/SelfServiceGate";

const headFields =
  "_id firstName lastName nickName position level photoUrl";
const empFields =
  "_id firstName lastName nickName position level photoUrl department departmentId";

const fullName = (e) =>
  [e?.firstName, e?.lastName].filter(Boolean).join(" ") || e?.nickName || "-";

export default async function EmployeeMyTeamPage({ searchParams }) {
  const session = await requirePage("self_team");
  await dbConnect();

  // Next.js รุ่นใหม่: searchParams เป็น Promise
  const sp = await searchParams;
  const overrideId = sp?.id || null;

  // ---- หา employee ของผู้ใช้ที่ล็อกอิน ----
  // Own team = the linked employee's (lib/accountLinks.js), never an email match.
  let viewer =
    (overrideId && (await Employee.findById(overrideId).lean())) ||
    (await employeeOfUser(session?.user?.id)) ||
    null;

  if (!viewer) {
    return overrideId ? (
      <div className="px-6 py-6 container mx-auto" style={{ color: "#5E6A7E" }}>
        ไม่พบข้อมูลพนักงาน
      </div>
    ) : (
      <UnlinkedNotice />
    );
  }

  // ---- สร้างชุด deptIds: แผนกของตัวเอง + แผนกที่ตัวเองเป็นหัวหน้า ----
  const deptIdSet = new Set();

  if (viewer.departmentId) {
    deptIdSet.add(String(viewer.departmentId));
  } else if (viewer.department) {
    const byCode = await Department.findOne({ code: viewer.department })
      .select("_id")
      .lean();
    if (byCode?._id) deptIdSet.add(String(byCode._id));
  }

  const headDepts = await Department.find({
    headOfDepartment: viewer._id,
  })
    .select("_id")
    .lean();

  headDepts.forEach((d) => deptIdSet.add(String(d._id)));

  const deptIds = [...deptIdSet];

  if (deptIds.length === 0) {
    return (
      <div className="px-6 py-6 container mx-auto" style={{ color: "#5E6A7E" }}>
        คุณยังไม่ได้สังกัดแผนก และไม่ได้เป็นหัวหน้าแผนกใด
      </div>
    );
  }

  // ---- ดึงข้อมูลแผนก + หัวหน้าแผนก ----
  const depts = await Department.find({ _id: { $in: deptIds } })
    .select("_id code name color headOfDepartment")
    .populate("headOfDepartment", headFields)
    .lean();

  // ---- ดึงสมาชิกทุกคนของแผนกที่เกี่ยวข้องในครั้งเดียว ----
  const members = await Employee.find({
    departmentId: { $in: deptIds },
  })
    .select(empFields)
    .lean();

  const memByDept = new Map(); // deptId -> []
  for (const m of members) {
    const k = String(m.departmentId || "");
    if (!memByDept.has(k)) memByDept.set(k, []);
    memByDept.get(k).push(m);
  }

  const payload = {
    viewer: {
      _id: String(viewer._id),
      name: fullName(viewer),
      position: viewer.position || "-",
      level: viewer.level || null,
      photoUrl: viewer.photoUrl || null,
    },
    depts: depts.map((d) => ({
      _id: String(d._id),
      code: d.code,
      name: d.name,
      color: d.color,
      head: d.headOfDepartment
        ? {
            _id: String(d.headOfDepartment._id),
            name: fullName(d.headOfDepartment),
            position: d.headOfDepartment.position || "-",
            level: d.headOfDepartment.level || null,
            photoUrl: d.headOfDepartment.photoUrl || null,
          }
        : null,
      members: (memByDept.get(String(d._id)) || []).map((m) => ({
        _id: String(m._id),
        name: fullName(m),
        position: m.position || "-",
        level: m.level || null,
        photoUrl: m.photoUrl || null,
      })),
    })),
  };

  return (
    <div className="px-6 py-6 container mx-auto">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "#0D1B2A" }}>My Team</h1>
      <p className="mb-4" style={{ color: "#5E6A7E", fontSize: 14 }}>
        แสดงแผนกของคุณ และแผนกที่คุณเป็นหัวหน้า พร้อมสมาชิกทั้งหมด
      </p>
      <MyTeamClient data={JSON.parse(JSON.stringify(payload))} />
    </div>
  );
}
