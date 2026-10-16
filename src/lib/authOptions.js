// src/lib/authOptions.js
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import Employee from "@/models/Employee";
import { permissionsFor, needsRefresh, refreshTokenPermissions } from "@/lib/rbac/sessionPerms";
import { RBAC_VERSION } from "@/lib/rbac/version";

// Permissions are resolved at sign-in and carried on the JWT; the jwt
// callback re-resolves them once they are older than ROLE_REFRESH_MS (5 min),
// so role edits, revocations, suspensions and new department heads reach
// signed-in users without a new sign-in (see lib/rbac/sessionPerms.js). The
// middleware reads these fields straight off the token, so jwt() must copy
// every one of them.

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
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

          const ok = await bcrypt.compare(password, user.passwordHash || "");
          if (!ok) {
            User.updateOne(
              { _id: user._id },
              { $inc: { failedLoginCount: 1 } }
            ).exec();
            return null;
          }

          // Update last login / reset failed count
          User.updateOne(
            { _id: user._id },
            { $set: { lastLoginAt: new Date(), failedLoginCount: 0 } }
          ).exec();

          // Resolve employee record
          let emp = null;
          if (user.employeeId) {
            emp = await Employee.findById(user.employeeId)
              .select("firstName lastName nickName empAutoId department photoUrl")
              .lean();
          }
          if (!emp) {
            emp = await Employee.findOne({ email })
              .select("firstName lastName nickName empAutoId department photoUrl")
              .lean();
          }

          const perms = await permissionsFor({ roleKey: user.role, employeeId: emp?._id });

          const displayName =
            emp?.firstName || emp?.lastName
              ? `${emp?.firstName ?? ""} ${emp?.lastName ?? ""}`.trim()
              : user.name || email.split("@")[0];

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
          };
        } catch (err) {
          console.error("authorize error:", err.message);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
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
      return session;
    },
  },
};
