import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";

const handler = NextAuth(authOptions);

// PUBLIC: NextAuth's own endpoints (sign-in, session, CSRF) must be reachable signed out.
export { handler as GET, handler as POST };
