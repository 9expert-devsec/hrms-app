import Employee from "@/models/Employee";

/** คืนเอกสาร Employee ของผู้ที่ล็อกอิน (หรือ null ถ้าไม่เจอ) */
export async function resolveEmployeeFromSession(session) {
  if (!session?.user) return null;

  // พยายามเดา id ที่โยงถึง employee ให้มากที่สุด
  const candidates = [
    session.user.employeeId,   // ใส่ไว้ใน session ตอน sign-in ได้
    session.user.id,           // id ของ user ในระบบ
    session.user._id,          // บางระบบเก็บ _id ใน session
  ].filter(Boolean);

  if (candidates.length === 0) return null;

  const emp =
    (await Employee.findOne({
      $or: [
        { _id: { $in: candidates } },
        { userId: { $in: candidates } },
        { user: { $in: candidates } }, // กันเคสเก่าที่ field ชื่อ user
      ],
    }).lean()) || null;

  return emp;
}
