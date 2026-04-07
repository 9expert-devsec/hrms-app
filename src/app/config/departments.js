// รายชื่อแผนก (โค้ดย่อ -> ชื่อเต็ม)
// หมายเหตุ: มี Media Department แยกเป็น MD2 เพื่อตัดปัญหาทับกับ Management/Director
export const DEPARTMENT_OPTIONS = [
  { code: "MD",  name: "Management / Director" },
  { code: "HR",  name: "Human Resources" },
  { code: "AC",  name: "Accounting" },
  { code: "IT",  name: "Information Technology" },
  { code: "TD",  name: "Training Department" },
  { code: "MK",  name: "Marketing" },
  { code: "SD",  name: "Software Development" },
  { code: "AM",  name: "Academic" },
  { code: "EX",  name: "Executive Office" },
  { code: "FM",  name: "Facility Management" },
  { code: "MD2", name: "Media Department" },
];

// Level ตาม requirement
export const LEVELS = [
  { value: 1, label: "Newbie (1)" },
  { value: 2, label: "Junior (2)" },
  { value: 3, label: "Senior (3)" },
  { value: 4, label: "Lead (4)" },
  { value: 5, label: "Manager (5)" },
  // 6 เฉพาะ MD เท่านั้น (CEO / CTO)
  { value: 6, label: "CEO / CTO (6)", mdOnly: true },
];
