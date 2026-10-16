import mongoose, { Schema, models } from "mongoose";
import { ALL_PAGE_KEYS } from "@/lib/rbac/pages";
import {
  DEFAULT_ROLE_COLOR as DEFAULT_COLOR,
  ROLE_KEY_RE,
  SUPERADMIN_KEY,
  normalizeHex,
} from "@/lib/rbac/roleRules";

/**
 * Role — a set of page keys from the registry (src/lib/rbac/pages.js).
 * A user either may open a page or may not. `isSuperadmin` bypasses every
 * check and belongs to the `superadmin` key only (validated below; the
 * roles API refuses it for any other key).
 *
 * The collection may be empty, or hold only some keys: resolveRole.js falls
 * back to SEED_ROLES. Saving a system role in the editor upserts its doc.
 * Writes go through src/lib/rbac/roles.js, which applies roleRules.js.
 */
const RoleSchema = new Schema(
  {
    // Permanent slug — what User.role and the session carry.
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      immutable: true,
      match: ROLE_KEY_RE,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    // Registry keys. Unknown keys are dropped on validate.
    pages: { type: [String], default: [] },
    color: { type: String, default: DEFAULT_COLOR },
    // Seeded role — not deletable (enforced by the round-8 editor).
    isSystem: { type: Boolean, default: false },
    isSuperadmin: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "roles" }
);

RoleSchema.pre("validate", function normalizeColor(next) {
  this.color = normalizeHex(this.color) || DEFAULT_COLOR;
  next();
});

RoleSchema.pre("validate", function onlySuperadminKeyIsSuperadmin(next) {
  if (this.isSuperadmin && this.key !== SUPERADMIN_KEY) {
    this.invalidate("isSuperadmin", "Only the superadmin role may have isSuperadmin");
  }
  next();
});

// Defensive only: the roles API already rejects unknown keys with a 400.
RoleSchema.pre("validate", function pruneUnknownPages(next) {
  if (Array.isArray(this.pages)) {
    const allowed = new Set(ALL_PAGE_KEYS);
    this.pages = this.pages.filter((k) => allowed.has(k));
  }
  next();
});

/**
 * Throws if another role already has isSuperadmin=true. Callers that set the
 * flag must call this before saving. `candidate` = { _id?, isSuperadmin }.
 */
RoleSchema.statics.assertSingleSuperadmin = async function assertSingleSuperadmin(candidate) {
  if (!candidate || !candidate.isSuperadmin) return;
  const query = { isSuperadmin: true };
  if (candidate._id) query._id = { $ne: candidate._id };
  const existing = await this.findOne(query).select("key").lean();
  if (existing) {
    throw new Error(`Superadmin is a singleton: role "${existing.key}" already has isSuperadmin=true.`);
  }
};

export default models.Role || mongoose.model("Role", RoleSchema);
