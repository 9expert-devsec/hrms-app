export const DEPT_PREFIX = {
  MD: "MD",  // Management / Director
  HR: "HR",  // Human Resources
  AC: "FN",  // Accounting => FN ตามที่คุณเขียน (ถ้าต้อง AC เปลี่ยนเป็น "AC")
  IT: "IT",  // Information Technology
  SA: "SA",  // Training Department  (คุณใช้ "TR" ในตำแหน่ง ด้านล่างยังคงได้)
  MK: "MK",  // Marketing
  SD: "SD",  // Software Development
  AM: "AM",  // Academic
  EX: "EX",  // Executive Office
  FM: "FM",  // Facility Management
  MD2: "MD"  // Media Department (ถ้าอยากใช้คีย์ MD ซ้ำ เปลี่ยนคีย์เป็น "MD_MEDIA")
};

export const POSITIONS_BY_DEPT = {
  MD: ["CEO", "COO", "CTO"],
  HR: ["HR Manager", "HR Officer"],
  AC: ["Accounting Manager", "Accounting Officer"],
  IT: ["Senior IT Support", "IT Support"],
  SA: ["Lead Training Consultant", "Training Consultant", "Training Staff", "Training Coordinator"],
  MK: ["Marketing Specialist", "Marketing Officer"],
  SD: ["Software Developer", "Web Developer"],
  AM: ["Academic Coordinator"],
  EX: ["Secretary"],
  FM: ["House Keeper"],
  MD2: ["Media Manager","Senior Digital Media Support","Video Content Editor","Graphic Designer"]
};

export const GENDERS = ["male","female","other"];
