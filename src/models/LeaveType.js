import { Schema, model, models } from "mongoose";

/**
 * A leave type HR manages on ตั้งค่าการลา › ประเภทการลา.
 *
 * `formCategory` — which box it ticks on paper form QF-HRD-001 and which row
 * of the form's statistics table it counts in. `systemKey` marks the three
 * seeded types (sick / personal / annual): they can be renamed and edited but
 * never deleted, and the key keeps the seed idempotent after a rename.
 * `nameKey` is the trimmed, lower-cased name (unique, so names are unique
 * case-insensitively).
 */
const LeaveTypeSchema = new Schema(
  {
    nameTh: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true },
    formCategory: { type: String, enum: ["sick", "personal", "annual", "other"], required: true },
    units: {
      type: [{ type: String, enum: ["day", "half", "hour"] }],
      validate: { validator: (v) => Array.isArray(v) && v.length > 0, message: "units must not be empty" },
    },
    defaultQuotaDays: { type: Number, min: 0, default: null }, // null = no limit
    requiresAttachmentFromDays: { type: Number, min: 0, default: null }, // null = never required
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, index: true },
    isSystem: { type: Boolean, default: false },
    systemKey: { type: String, enum: ["sick", "personal", "annual"], default: undefined },
  },
  { timestamps: true }
);

LeaveTypeSchema.index({ systemKey: 1 }, { unique: true, partialFilterExpression: { systemKey: { $type: "string" } } });

export default models.LeaveType || model("LeaveType", LeaveTypeSchema);
