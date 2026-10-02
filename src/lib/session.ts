import { SignJWT, jwtVerify } from "jose";

/** Edge-safe JWT helpers (used by middleware and route handlers). */
export const ADMIN_COOKIE = "sq_admin";
export const SIGNER_COOKIE = "sq_signer";

function secret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "");
}

export async function signToken(payload: Record<string, unknown>, ttl: string): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(ttl).sign(secret());
}

export async function readToken<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as T;
  } catch {
    return null;
  }
}
