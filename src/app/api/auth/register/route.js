import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import Employee from "@/models/Employee";
import { requireSuperadminApi } from "@/lib/rbac/guard";
import { assertAssignableRole, RoleError } from "@/lib/rbac/roles";
import { newAccountPassword } from "@/lib/accounts";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

// Creates a login with any role, so it is superadmin-only — the same as its
// only caller, /dashboard/admin/register. It used to have no auth check.
// The password is never chosen by the creator: the server issues a temporary
// one, returned ONCE in this response, and the user must change it at first
// sign-in (lib/accounts.js newAccountPassword).
export async function POST(req) {
  try {
    const gate = await requireSuperadminApi();
    if (gate.res) return gate.res;

    const { name, email, role: rawRole = "employee" } = await req.json();
    if (!email) {
      return Response.json({ error: "email required" }, { status: 400, headers: NO_STORE });
    }
    const role = String(rawRole || "employee").trim().toLowerCase();

    await dbConnect();

    // The role must be a known key (roles collection or seed) — never stored blindly.
    try {
      await assertAssignableRole(role, { actor: gate.session.user });
    } catch (e) {
      if (e instanceof RoleError) return Response.json({ error: e.message }, { status: e.status, headers: NO_STORE });
      throw e;
    }

    const existed = await User.findOne({ email });
    if (existed) return Response.json({ error: "Email already in use" }, { status: 409, headers: NO_STORE });

    const { tempPassword, fields } = await newAccountPassword();
    const user = await User.create({ name: name || email, email, role, ...fields });

    // ผูก userId กลับไปที่ employee (ถ้ามีพนักงานอีเมลนี้อยู่) — only one that
    // has no account yet: the link is one-to-one (lib/accountLinks.js).
    const linked = await Employee.findOneAndUpdate(
      { email, userId: null },
      { $set: { userId: user._id } },
      { projection: { _id: 1 } }
    ).lean();
    if (linked) await User.updateOne({ _id: user._id }, { $set: { employeeId: linked._id } });

    return Response.json(
      { ok: true, id: user._id, email: user.email, role: user.role, tempPassword },
      { status: 201, headers: NO_STORE }
    );
  } catch (e) {
    console.error("[REGISTER]", e);
    return Response.json({ error: "Server error" }, { status: 500, headers: NO_STORE });
  }
}
