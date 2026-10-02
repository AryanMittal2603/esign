import { cookies } from "next/headers";
import { ADMIN_COOKIE, SIGNER_COOKIE, readToken, signToken } from "./session";

const secure = process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https");

export async function setAdminSession(adminId: string) {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, await signToken({ sub: adminId, role: "admin" }, "12h"), {
    httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 12,
  });
}

export async function getAdmin(): Promise<{ sub: string } | null> {
  const jar = await cookies();
  return readToken<{ sub: string; role: string }>(jar.get(ADMIN_COOKIE)?.value);
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

/** A signatory session proves control of one mobile number (verified by OTP). */
export async function setSignerSession(mobile: string) {
  const jar = await cookies();
  jar.set(SIGNER_COOKIE, await signToken({ mobile }, "2h"), {
    httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 2,
  });
}

export async function getSignerMobile(): Promise<string | null> {
  const jar = await cookies();
  const t = await readToken<{ mobile: string }>(jar.get(SIGNER_COOKIE)?.value);
  return t?.mobile ?? null;
}

export async function clearSignerSession() {
  (await cookies()).delete(SIGNER_COOKIE);
}
