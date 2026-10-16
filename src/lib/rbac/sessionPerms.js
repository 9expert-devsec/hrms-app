import "server-only";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import { getRoleByKey, getHeadOfDepartmentIds } from "@/lib/rbac/resolveRole";
import { ROLE_REFRESH_MS } from "@/lib/rbac/version";

/**
 * Permissions carried on the JWT, and their periodic refresh.
 *
 * Sign-in (authorize) and the refresh both use permissionsFor(), so the two
 * can never disagree. The refresh runs in the NextAuth jwt callback whenever
 * the token's permsCheckedAt is older than ROLE_REFRESH_MS.
 *
 * next-auth v4's getServerSession (App Router) cannot write the cookie back,
 * so a stale token keeps arriving until the browser's /api/auth/session poll
 * rewrites it. The per-process cache below keeps that to at most one DB read
 * per user per ROLE_REFRESH_MS per server instance; the data on the token is
 * never older than ROLE_REFRESH_MS (its stamp is the DB read time).
 */

/** Role-derived fields for the token. */
export async function permissionsFor({ roleKey, employeeId }) {
  const role = await getRoleByKey(roleKey);
  return {
    roleKey,
    roleName: role.name,
    roleColor: role.color,
    isSuperadmin: role.isSuperadmin,
    // null = superadmin (allow all); never ship the full key list.
    pages: role.isSuperadmin ? null : role.pages,
    headOfDepartmentIds: await getHeadOfDepartmentIds(employeeId),
  };
}

const cache = new Map(); // uid → { at, result }

function fromCache(uid) {
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < ROLE_REFRESH_MS) return hit;
  return null;
}

function remember(uid, result) {
  if (cache.size > 2000) cache.clear();
  const entry = { at: Date.now(), result };
  cache.set(uid, entry);
  return entry;
}

/** A token every guard treats as signed out (RBAC version gone, no rights). */
function revokedToken(token) {
  return {
    ...token,
    rbac: null,
    revoked: true,
    isSuperadmin: false,
    pages: [],
    headOfDepartmentIds: [],
    permsCheckedAt: Date.now(),
  };
}

/** Is the token's permission data older than ROLE_REFRESH_MS? */
export function needsRefresh(token) {
  return Date.now() - (Number(token?.permsCheckedAt) || 0) >= ROLE_REFRESH_MS;
}

/**
 * Re-read the user (role + status) and re-resolve pages, isSuperadmin and
 * headOfDepartmentIds. A suspended or deleted user gets a revoked token.
 */
export async function refreshTokenPermissions(token) {
  const uid = String(token?.uid || "");
  let entry = fromCache(uid);

  if (!entry) {
    try {
      await dbConnect();
      const user = mongoose.isValidObjectId(uid)
        ? await User.findById(uid).select("role status").lean()
        : null;
      if (!user || (user.status && user.status !== "active")) {
        entry = remember(uid, { revoked: true });
      } else {
        const perms = await permissionsFor({ roleKey: user.role, employeeId: token.employeeId });
        entry = remember(uid, { revoked: false, role: user.role, perms });
      }
    } catch (err) {
      // DB unreachable: keep the current permissions, retry in ~30 s rather
      // than on every request.
      console.error("[rbac] permission refresh failed:", err?.message || err);
      return { ...token, permsCheckedAt: Date.now() - ROLE_REFRESH_MS + 30_000 };
    }
  }

  if (entry.result.revoked) return revokedToken(token);
  return {
    ...token,
    role: entry.result.role,
    ...entry.result.perms,
    permsCheckedAt: entry.at,
  };
}
