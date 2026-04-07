// src/lib/authOptions.js
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import Employee from "@/models/Employee";

export const authOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        await dbConnect();
        const user = await User.findOne({ email: credentials.email }).lean();
        if (!user) return null;
        const ok = await compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          _id: user._id.toString(),
          email: user.email,
          role: user.role || "employee",
          employeeId: user.employeeId ? user.employeeId.toString() : null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      await dbConnect();

      // ครั้งแรกหลัง authorize()
      if (user) {
        token.uid = user._id;
        token.id = user._id;
        token.email = user.email;
        token.role = user.role || "employee";
        token.employeeId = user.employeeId || null;
      }

      // ถ้าไม่มี employeeId → หาให้ด้วย userId ก่อน แล้วค่อย fallback email (ไม่สนตัวพิมพ์)
      if (!token.employeeId) {
        const empByUser = await Employee.findOne({ userId: token.uid })
          .select("_id empAutoId department photoUrl")
          .lean();

        let emp = empByUser;
        if (!emp && token.email) {
          const safe = (token.email || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          emp = await Employee.findOne({ email: new RegExp(`^${safe}$`, "i") })
            .select("_id empAutoId department photoUrl")
            .lean();
        }

        if (emp?._id) {
          token.employeeId = emp._id.toString();
          token.empAutoId = emp.empAutoId ?? null;
          token.department = emp.department ?? null;
          token.photoUrl = emp.photoUrl ?? null;
        }
      } else {
        const emp = await Employee.findById(token.employeeId)
          .select("empAutoId department photoUrl")
          .lean();
        token.empAutoId = emp?.empAutoId ?? null;
        token.department = emp?.department ?? null;
        token.photoUrl = emp?.photoUrl ?? null;
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.uid || token.id || token.sub; // ⬅️ สำคัญ
      session.user.email = token.email;
      session.user.role = token.role || "employee";
      session.user.empAutoId = token.empAutoId ?? null;
      session.user.department = token.department ?? null;
      session.user.photoUrl = token.photoUrl ?? null;
      session.user.employeeId = token.employeeId ?? null;
      return session;
    },
  },
  pages: { signIn: "/login" },
};
