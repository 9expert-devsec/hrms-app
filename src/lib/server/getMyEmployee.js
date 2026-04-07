// src/lib/server/getMyEmployee.js
import Employee from "@/models/Employee";

export async function getMyEmployee(user) {
  const uid = user?._id;
  if (!uid) return null;

  // ครอบทุกเคสที่โปรเจ็กต์ใช้ไว้
  const emp = await Employee.findOne({
    $or: [
      { _id: user?.employeeId },  // มีลิงก์ไว้แล้ว
      { userId: uid },            // แบบฟิลด์ userId
      { user: uid },              // บางที่เก็บเป็น user
    ],
  })
    .select("_id departmentId firstName lastName position")
    .lean();

  return emp || null;
}
