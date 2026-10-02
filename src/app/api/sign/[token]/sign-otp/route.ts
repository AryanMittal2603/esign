import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { issueOtp } from "@/lib/otp";
import { clientInfo, fail, ok } from "@/lib/http";
import { loadByToken } from "@/lib/signer";

/** Records consent and sends the signing OTP. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadByToken(token);
  if (!ctx) return fail("This link is not valid.", 404);
  if (!ctx.authorised) return fail("Verify your mobile number first.", 401);
  const s = ctx.s;
  if (s.signedAt) return fail("This CSR is already signed.", 409);
  if (!s.draftKey) return fail("Upload your CSR first.", 409);
  if (!s.photoKey) return fail("Take your live photo first.", 409);

  const body = await req.json().catch(() => ({}));
  if (body.consent !== true) return fail("Please accept both declarations.");
  const info = clientInfo(req);

  if (!s.consentAt) {
    await db.signatory.update({ where: { id: s.id }, data: { consentAt: new Date() } });
    await audit({
      action: "CONSENT_ACCEPTED", actor: "SIGNATORY", projectId: s.projectId, signatoryId: s.id,
      details: {
        declarations: [
          "I confirm this CSR is the true report of my centre for this exam.",
          "I agree to sign electronically with my live photo and a mobile OTP.",
        ],
      },
      ...info,
    });
  }

  const r = await issueOtp(s.mobile, "SIGN", s.id);
  if (!r.ok) return fail(r.error, r.status, { resendIn: r.resendIn });
  await audit({ action: "SIGN_OTP_SENT", actor: "SIGNATORY", projectId: s.projectId, signatoryId: s.id, details: { ref: r.ref }, ...info });
  return ok({ sent: true, resendIn: r.resendIn });
}
