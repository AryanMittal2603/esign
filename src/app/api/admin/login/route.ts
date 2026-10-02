import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { setAdminSession } from "@/lib/auth";
import { clientInfo, fail, ok } from "@/lib/http";

const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const info = clientInfo(req);
  const gate = attempts.get(info.ip);
  if (gate && gate.until > Date.now()) return fail("Too many attempts. Try again in a few minutes.", 429);

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const admin = email ? await db.admin.findUnique({ where: { email } }) : null;
  const good = admin ? await bcrypt.compare(password, admin.passwordHash) : false;

  if (!admin || !good) {
    const n = (gate?.n ?? 0) + 1;
    attempts.set(info.ip, { n, until: n >= 5 ? Date.now() + 5 * 60_000 : 0 });
    return fail("Email or password is not right.", 401);
  }
  attempts.delete(info.ip);
  await setAdminSession(admin.id);
  await audit({ action: "ADMIN_LOGIN", actor: "ADMIN", details: { email }, ...info });
  return ok({ name: admin.name });
}
