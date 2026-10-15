import mongoose, { Schema, models } from "mongoose";
import { ALL_PAGE_KEYS } from "@/lib/rbac/pages";

/**
 * Role — a set of page keys from the registry (src/lib/rbac/pages.js).
 * A user either may open a page or may not. `isSuperadmin` bypasses every
 * check and is a singleton, enforced by callers via assertSingleSuperadmin
 * (not a hook, to keep the write path cheap).
 *
 * Until the round-8 role editor writes documents, the collection may be
 * empty; resolveRole.js then falls back to SEED_ROLES.
 */
const DEFAULT_COLOR = "#6b7280";

/** '#abc' / '#aabbcc' (any case, with or without '#') → '#aabbcc', else null. */
function normalizeHex(value) {
  if (typeof value !== "string") return null;
  let hex = value.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(hex)) hex = hex.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : null;
}

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
      match: /^[a-z0-9_-]+$/,
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
