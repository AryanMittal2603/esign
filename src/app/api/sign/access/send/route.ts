import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { issueOtp } from "@/lib/otp";
import { MOBILE_RE, clientInfo, fail, normaliseMobile, ok } from "@/lib/http";
import { maskMobile } from "@/lib/format";

/** Send the access OTP — either for a secure link (token) or a mobile number typed in directly. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const info = clientInfo(req);
  let mobile: string;
  let signatory: { id: string; projectId: string } | null = null;

  if (body.token) {
    const s = await db.signatory.findUnique({ where: { token: String(body.token) } });
    if (!s) return fail("This link is not valid.", 404);
    mobile = s.mobile;
    signatory = s;
  } else {
    mobile = normaliseMobile(body.mobile);
    if (!MOBILE_RE.test(mobile)) return fail("Enter a valid 10-digit mobile number.");
    const count = await db.signatory.count({ where: { mobile } });
    if (!count) return fail("This number is not registered for any report. Check with your exam office.", 404);
  }

  const r = await issueOtp(mobile, "ACCESS");
  if (!r.ok) return fail(r.error, r.status, { resendIn: r.resendIn });
  await audit({ action: "OTP_SENT", actor: "SIGNATORY", projectId: signatory?.projectId, signatoryId: signatory?.id, details: { purpose: "access", ref: r.ref }, ...info });
  return ok({ sent: true, mobileMasked: maskMobile(mobile), resendIn: r.resendIn });
}
