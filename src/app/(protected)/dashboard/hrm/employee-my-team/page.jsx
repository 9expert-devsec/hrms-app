// src/app/(protected)/dashboard/hrm/employee-my-team/page.jsx
// ทีมของฉัน: the viewer's own department + every department they head. Same
// departments, members and links as before — only the layout changed.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import dbConnect from "@/lib/mongoose";
import { requirePage } from "@/lib/rbac/guard";
import { profileAccess } from "@/lib/rbac/scopes";
import { employeeOfUser } from "@/lib/rbac/scopeQueries";
import Department from "@/models/Department";
import Employee from "@/models/Employee";
import { employeeDisplayName } from "@/lib/employeeName";
import { UnlinkedNotice } from "./../../../../../components/SelfServiceGate";
import PersonAvatar from "./../../../../../components/PersonAvatar";

const NAVY = "#0D1B2A";
const BLUE = "#005CFF";
const LIME = "#D4F73F";
const SLATE = "#5E6A7E";

const personFields = "_id firstName lastName firstNameTh lastNameTh nickName position photoUrl department departmentId";

// Thai name when present, else English (lib/employeeName.js)
const nameOf = (e) => employeeDisplayName(e) || e?.nickName || "-";
const byName = (a, b) => a.name.localeCompare(b.name, "th");

function Page({ children }) {
  return (
    <div className="-m-6 min-h-full px-4 py-4 md:px-8 md:py-7" style={{ background: "#F5F7FB" }}>
      <div className="mx-auto max-w-[1360px] space-y-4 md:space-y-6">{children}</div>
    </div>
  );
}

function Muted({ children, testid }) {
  return (
    <p className="text-[14px]" style={{ color: SLATE }} data-testid={testid}>
      {children}
    </p>
  );
}

export default async function EmployeeMyTeamPage({ searchParams }) {
  const session = await requirePage("self_team");
  await dbConnect();

  // Next.js รุ่นใหม่: searchParams เป็น Promise
  const sp = await searchParams;
  const overrideId = sp?.id || null;

  // Own team = the linked employee's (lib/accountLinks.js), never an email match.
  const viewer =
    (overrideId && (await Employee.findById(overrideId).lean().catch(() => null))) ||
    (await employeeOfUser(session?.user?.id)) ||
    null;

  if (!viewer) {
    return overrideId ? (
      <Page>
        <Muted>ไม่พบข้อมูลพนักงาน</Muted>
      </Page>
    ) : (
      <UnlinkedNotice />
    );
  }
  const viewerId = String(viewer._id);

  // ---- แผนกของตัวเอง (departmentId, else by code) + แผนกที่ตัวเองเป็นหัวหน้า ----
  let ownDeptId = viewer.departmentId ? String(viewer.departmentId) : null;
  if (!ownDeptId && viewer.department) {
    const byCode = await Department.findOne({ code: viewer.department }).select("_id").lean();
    if (byCode?._id) ownDeptId = String(byCode._id);
  }
  const headDepts = await Department.find({ headOfDepartment: viewer._id }).select("_id").lean();
  const deptIds = [...new Set([ownDeptId, ...headDepts.map((d) => String(d._id))].filter(Boolean))];

  if (deptIds.length === 0) {
    return (
      <Page>
        <Muted testid="team-no-department">ยังไม่ได้ระบุแผนกของคุณ</Muted>
      </Page>
    );
  }

  const [depts, members] = await Promise.all([
    Department.find({ _id: { $in: deptIds } })
      .select("_id code name headOfDepartment")
      .populate("headOfDepartment", personFields)
      .lean(),
    // Members = every employee whose departmentId is one of these departments.
    Employee.find({ departmentId: { $in: deptIds } }).select(personFields).lean(),
  ]);

  // The card shows a nickname only to viewers who can already see it on that
  // person's profile (the profile page's rule — lib/rbac/scopes.js).
  const toPerson = (e, departmentId) => {
    const id = String(e._id);
    const canView =
      id === viewerId && !overrideId
        ? true
        : profileAccess(session.user, { targetEmployeeId: e._id, targetDepartmentId: departmentId, targetDepartmentCode: e.department }).canView;
    const nickName = canView ? (e.nickName || "").trim() : "";
    return {
      id,
      name: nameOf(e),
      sub: [nickName, (e.position || "").trim()].filter(Boolean).join(" · "),
      photoUrl: e.photoUrl || null,
      isSelf: id === viewerId,
    };
  };

  const memByDept = new Map();
  for (const m of members) {
    const k = String(m.departmentId || "");
    if (!memByDept.has(k)) memByDept.set(k, []);
    memByDept.get(k).push(m);
  }

  const cards = depts
    .map((d) => {
      const id = String(d._id);
      const head = d.headOfDepartment ? toPerson(d.headOfDepartment, d.headOfDepartment.departmentId ? String(d.headOfDepartment.departmentId) : null) : null;
      const list = (memByDept.get(id) || [])
        .filter((m) => !head || String(m._id) !== head.id)
        .map((m) => toPerson(m, id))
        .sort((a, b) => (a.isSelf === b.isSelf ? byName(a, b) : a.isSelf ? -1 : 1));
      return {
        id,
        code: (d.code || "").trim(),
        name: d.name || d.code || "-",
        isOwn: id === ownDeptId,
        isHead: !!head && head.id === viewerId,
        head,
        members: list,
      };
    })
    .sort((a, b) => (a.isOwn === b.isOwn ? a.name.localeCompare(b.name, "th") : a.isOwn ? -1 : 1));

  return (
    <Page>
      <Muted>คนในแผนกของคุณ และแผนกที่คุณเป็นหัวหน้า กดที่ชื่อเพื่อดูโปรไฟล์และเบอร์ติดต่อ</Muted>
      {cards.map((d) => (
        <DepartmentCard key={d.id} d={d} />
      ))}
    </Page>
  );
}

function Tag({ children }) {
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: LIME, color: NAVY }}>
      {children}
    </span>
  );
}

function Label({ children }) {
  return (
    <p className="text-[13px] font-semibold" style={{ color: SLATE }}>
      {children}
    </p>
  );
}

function DepartmentCard({ d }) {
  return (
    <section className="flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 md:px-6" style={{ border: "1px solid #E3EAF5" }} data-testid="team-dept" data-dept={d.name}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]" style={{ background: "#EEF4FF", color: BLUE }}>
          <Building2 size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[18px] font-bold" style={{ color: NAVY }} data-testid="team-dept-name">{d.name}</h2>
            {d.code && (
              <span className="rounded-[6px] px-2 py-0.5 text-[12px] font-semibold" style={{ background: "#F1F4F8", color: SLATE }} data-testid="team-dept-code">
                {d.code}
              </span>
            )}
            {d.isOwn && <Tag>แผนกของคุณ</Tag>}
            {d.isHead && <Tag>คุณเป็นหัวหน้า</Tag>}
          </div>
          <p className="mt-0.5 text-[13px]" style={{ color: SLATE }} data-testid="team-dept-count">
            สมาชิก {d.members.length} คน
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>หัวหน้าแผนก</Label>
        {d.head ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            <PersonCard p={d.head} variant="head" />
          </div>
        ) : (
          <Muted testid="team-no-head">ยังไม่ได้กำหนดหัวหน้าแผนก</Muted>
        )}
      </div>

      <div className="space-y-2">
        <Label>สมาชิก</Label>
        {d.members.length === 0 ? (
          <Muted testid="team-no-members">ยังไม่มีสมาชิกในแผนกนี้</Muted>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {d.members.map((m) => (
              <PersonCard key={m.id} p={m} variant={m.isSelf ? "self" : "default"} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const VARIANTS = {
  default: { background: "#FFFFFF", border: "1px solid #E3EAF5" },
  head: { background: "#FFFBEA", border: "1px solid #F2DD8A" },
  self: { background: "#F7FBE6", border: `1px solid ${LIME}` },
};

/** One person → their profile view. Head + self keeps the head colours with the "คุณ" pill. */
function PersonCard({ p, variant }) {
  return (
    <Link
      href={`/dashboard/hrm/employee-profile?id=${p.id}`}
      className="flex min-h-[44px] items-center gap-3 rounded-[14px] px-3.5 py-3 no-underline transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005CFF]"
      style={VARIANTS[variant]}
      data-testid="team-person"
      data-variant={variant}
      data-self={p.isSelf ? "1" : "0"}
      data-id={p.id}
    >
      <PersonAvatar src={p.photoUrl} name={p.name} size={44} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold" style={{ color: NAVY }} data-testid="team-person-name">{p.name}</span>
          {p.isSelf && (
            <span className="shrink-0 rounded-full px-2 py-px text-[11px] font-semibold" style={{ background: "#EEF4FF", color: BLUE }} data-testid="team-you">
              คุณ
            </span>
          )}
        </span>
        {p.sub && (
          <span className="block truncate text-[13px]" style={{ color: SLATE }} data-testid="team-person-sub">{p.sub}</span>
        )}
      </span>
      <ChevronRight size={16} className="shrink-0" style={{ color: SLATE }} aria-hidden />
    </Link>
  );
}
