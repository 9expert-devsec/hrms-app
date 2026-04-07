export const DEPARTMENT_CATALOG = [
  { code: "MD",  fullName: "Management / Director", order: 1,  color: "#f59e0b" },
  { code: "HR",  fullName: "Human Resources",        order: 2,  color: "#06b6d4" },
  { code: "AC",  fullName: "Accounting",             order: 3,  color: "#8b5cf6" },
  { code: "IT",  fullName: "Information Technology", order: 4,  color: "#22c55e" },
  { code: "TD",  fullName: "Training Department",    order: 5,  color: "#f97316" },
  { code: "MK",  fullName: "Marketing",              order: 6,  color: "#ec4899" },
  { code: "SD",  fullName: "Software Development",   order: 7,  color: "#a855f7" },
  { code: "AM",  fullName: "Academic",               order: 8,  color: "#ef4444" },
  { code: "EX",  fullName: "Executive Office",       order: 9,  color: "#10b981" },
  { code: "FM",  fullName: "Facility Management",    order: 10, color: "#14b8a6" },
  // NOTE: "Media Department" มี code ชนกับ MD ในสเปกเดิม
  // แนะนำใช้โค้ด "ME" เพื่อไม่ชน (ถ้าจำเป็นคุณเปลี่ยนกลับเป็น MD ได้)
  { code: "ME",  fullName: "Media Department",       order: 11, color: "#3b82f6" },
];

export const LEVEL_BASE = [
  { value: 1, label: "Newbie"  },
  { value: 2, label: "Junior"  },
  { value: 3, label: "Senior"  },
  { value: 4, label: "Lead"    },
  { value: 5, label: "Manager" },
];

export const LEVEL_MD = [
  ...LEVEL_BASE,
  { value: 6, label: "C-Level (CEO/CTO)" }, // เฉพาะ MD
];

export function levelsForDept(code) {
  return code === "MD" ? LEVEL_MD : LEVEL_BASE;
}

export function levelName(code, value) {
  const item = levelsForDept(code).find((x) => x.value === value);
  return item?.label ?? `L${value}`;
}

export const DEPT_MAP =
  Object.fromEntries(DEPARTMENT_CATALOG.map((d) => [d.code, d]));
