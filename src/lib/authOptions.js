// src/lib/authOptions.js
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import { employeeOfUser } from "@/lib/rbac/scopeQueries";
import { employeeDisplayName } from "@/lib/employeeName";
import { permissionsFor, needsRefresh, refreshTokenPermissions } from "@/lib/rbac/sessionPerms";
import { RBAC_VERSION } from "@/lib/rbac/version";
import {
  LOGIN_MAX_FAILURES,
  LOGIN_LOCK_MS,
  ACCOUNT_LOCKED_ERROR,
  isLocked,
} from "@/lib/loginLockout";

// Lockout (lib/loginLockout.js). Every write is one atomic findOneAndUpdate /
// updateOne whose filter excludes a currently-locked account, so parallel
// attempts can't skip the threshold and a locked account is never pushed
// into a longer lock.
/** Session lifetime (round 18): 7 days. */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const notLocked = (now) => ({ $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] });

/** Count a wrong password. Returns true when the account is now locked. */
async function recordFailedSignIn(userId) {
  const now = new Date();
  const updated = await User.findOneAndUpdate(
    { _id: userId, ...notLocked(now) },
    [
      // A lock that has expired starts a fresh count.
      {
        $set: {
          failedLoginCount: {
            $cond: [
              { $eq: [{ $type: "$lockedUntil" }, "date"] },
              1,
              { $add: [{ $ifNull: ["$failedLoginCount", 0] }, 1] },
            ],
          },
        },
      },
      {
        $set: {
          lockedUntil: {
            $cond: [
              { $gte: ["$failedLoginCount", LOGIN_MAX_FAILURES] },
              new Date(now.getTime() + LOGIN_LOCK_MS),
              null,
            ],
          },
        },
      },
    ],
    { new: true, projection: { lockedUntil: 1 } }
  ).lean();
  // No match = another attempt locked it in the meantime.
  return !updated || isLocked(updated.lockedUntil, now.getTime());
}

/** Successful sign-in: reset the counter. False if the account got locked meanwhile. */
async function recordSuccessfulSignIn(userId) {
  const now = new Date();
  const r = await User.updateOne(
    { _id: userId, ...notLocked(now) },
    { $set: { lastLoginAt: now, failedLoginCount: 0, lockedUntil: null } }
  );
  return r.matchedCount > 0;
}

// Permissions are resolved at sign-in and carried on the JWT; the jwt
// callback re-resolves them once they are older than ROLE_REFRESH_MS (5 min),
// so role edits, revocations, suspensions and new department heads reach
// signed-in users without a new sign-in (see lib/rbac/sessionPerms.js). The
// middleware reads these fields straight off the token, so jwt() must copy
// every one of them.

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  // 7 days, rolling: next-auth re-issues the JWT cookie (now + maxAge) on every
  // /api/auth/session call, so an active session keeps extending; an idle one
  // ends 7 days after its last refresh. Sessions issued earlier (30-day
  // default) take the 7-day lifetime at their next refresh.
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const { email, password } = credentials ?? {};
          if (!email || !password) return null;

          await dbConnect();

          const user = await User.findOne({ email }).lean();
          if (!user) return null;
          if (user.status && user.status !== "active") return null;

          // Locked: refuse without comparing the password or counting the
          // attempt. Only an existing, locked account sees this message;
          // unknown emails and wrong passwords stay generic (return null).
          if (isLocked(user.lockedUntil)) throw new Error(ACCOUNT_LOCKED_ERROR);

          const ok = await bcrypt.compare(password, user.passwordHash || "");
          if (!ok) {
            // The attempt that reaches LOGIN_MAX_FAILURES gets the lock message.
            if (await recordFailedSignIn(user._id)) throw new Error(ACCOUNT_LOCKED_ERROR);
            return null;
          }

          // Update last login / reset failed count and lock
          if (!(await recordSuccessfulSignIn(user._id))) throw new Error(ACCOUNT_LOCKED_ERROR);

          // The linked employee (Employee.userId — lib/accountLinks.js). No
          // email fallback: an unlinked account has no employee, rather than
          // borrowing whoever shares its email.
          const emp = await employeeOfUser(
            user._id,
            "firstName lastName firstNameTh lastNameTh nickName empAutoId department photoUrl"
          );

          const perms = await permissionsFor({ roleKey: user.role, employeeId: emp?._id });

          // Thai name when present, else English (lib/employeeName.js).
          const displayName = employeeDisplayName(emp) || user.name || email.split("@")[0];

          return {
            id: String(user._id),
            name: displayName,
            email: user.email,
            role: user.role,
            ...perms,
            employeeId: emp?._id ? String(emp._id) : null,
            empAutoId: emp?.empAutoId || null,
            department: emp?.department || null,
            image: emp?.photoUrl ?? null,
            photoUrl: emp?.photoUrl ?? null,
            // Set after a temporary-password reset: everything but the
            // change-password page is blocked until it is cleared.
            mustChangePassword: user.mustChangePassword === true,
          };
        } catch (err) {
          if (err?.message === ACCOUNT_LOCKED_ERROR) throw err;
          console.error("authorize error:", err.message);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.mustChangePassword = user.mustChangePassword === true;
        token.uid = user.id;
        token.role = user.role;
        token.rbac = RBAC_VERSION;
        token.roleKey = user.roleKey;
        token.roleName = user.roleName ?? null;
        token.roleColor = user.roleColor ?? null;
        token.isSuperadmin = user.isSuperadmin === true;
        token.pages = user.pages ?? null;
        token.headOfDepartmentIds = user.headOfDepartmentIds ?? [];
        token.employeeId = user.employeeId ?? null;
        token.empAutoId = user.empAutoId ?? null;
        token.department = user.department ?? null;
        token.name = user.name || token.name;
        token.picture = user.image ?? null;
        token.photoUrl = user.photoUrl ?? user.image ?? null;
        token.permsCheckedAt = Date.now();
        return token;
      }
      // Live refresh: a current-version token whose permissions are older
      // than ROLE_REFRESH_MS is re-resolved from the DB (cached per process).
      // A suspended or deleted user comes back as a revoked token.
      // useSession().update() (after a password change): re-read the user
      // from the DB now, ignoring the cache. The client's payload is never
      // trusted — only the DB decides mustChangePassword and the rest.
      if (trigger === "update" && token?.uid && token.rbac === RBAC_VERSION) {
        return refreshTokenPermissions(token, { force: true });
      }
      if (token?.uid && token.rbac === RBAC_VERSION && needsRefresh(token)) {
        return refreshTokenPermissions(token);
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid || token.sub;
      session.user.email = token.email;
      session.user.role = token.role || "employee";
      session.user.rbac = token.rbac ?? null;
      session.user.roleKey = token.roleKey ?? token.role ?? null;
      session.user.roleName = token.roleName ?? null;
      session.user.roleColor = token.roleColor ?? null;
      session.user.isSuperadmin = token.isSuperadmin === true;
      session.user.pages = token.pages ?? null;
      session.user.headOfDepartmentIds = token.headOfDepartmentIds ?? [];
      session.user.employeeId = token.employeeId ?? null;
      session.user.empAutoId = token.empAutoId ?? null;
      session.user.department = token.department ?? null;
      session.user.name = token.name || session.user.name;
      session.user.image = token.picture ?? null;
      session.user.photoUrl = token.photoUrl ?? null;
      session.user.mustChangePassword = token.mustChangePassword === true;
      return session;
    },
  },
};
