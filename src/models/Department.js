import { Schema, model, models } from "mongoose";

const DepartmentSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    color: { type: String, default: "#6366f1" },
    empIdPrefix: { type: String, default: "" },
    description: { type: String, default: "" },

    // เดิมคุณใช้ allowLevels/allowedLevels ทั้งคู่ เจออันไหนใน DB ก็ปล่อยไว้
    allowLevels: { type: [Number], default: [] },
    allowedLevels: { type: [Number], default: [] },

    positions: {
      type: [
        {
          name: String,
          level: Number,
        },
      ],
      default: [],
    },

    // 🆕 หัวหน้าแผนก (1 แผนกมีได้ 1 คน แต่ 1 คนเป็นหัวหน้าได้หลายแผนก)
    headOfDepartment: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  { timestamps: true }
);

export default models.Department || model("Department", DepartmentSchema);
