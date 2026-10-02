import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { verifyOtp } from "@/lib/otp";
import { setSignerSession } from "@/lib/auth";
import { MOBILE_RE, clientInfo, fail, normaliseMobile, ok } from "@/lib/http";
import { markOpenedAndVerified } from "@/lib/signer";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const info = clientInfo(req);
  const code = String(body.code ?? "").trim();
  let mobile: string;
  let signatory = null as Awaited<ReturnType<typeof db.signatory.findUnique>>;

  if (body.token) {
    signatory = await db.signatory.findUnique({ where: { token: String(body.token) } });
    if (!signatory) return fail("This link is not valid.", 404);
    mobile = signatory.mobile;
  } else {
    mobile = normaliseMobile(body.mobile);
    if (!MOBILE_RE.test(mobile)) return fail("Enter a valid 10-digit mobile number.");
  }

  const r = await verifyOtp(mobile, "ACCESS", code);
  if (!r.ok) {
    await audit({ action: "OTP_FAILED", actor: "SIGNATORY", projectId: signatory?.projectId, signatoryId: signatory?.id, ...info });
    return fail(r.error, 400);
  }

  await setSignerSession(mobile);
  if (signatory) {
    await markOpenedAndVerified(signatory, true);
    await audit({ action: "OTP_VERIFIED", actor: "SIGNATORY", projectId: signatory.projectId, signatoryId: signatory.id, details: { ref: r.ref }, ...info });
  }
  return ok({ verified: true });
}
