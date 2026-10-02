import crypto from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/crypto";
import { verifyOtp } from "@/lib/otp";
import { clientInfo, describeDevice, fail, ok } from "@/lib/http";
import { fmtIST, fmtTimeIST, maskMobile } from "@/lib/format";
import { actionText } from "@/lib/actions";
import { signPdf } from "@/lib/pdf";
import { loadByToken } from "@/lib/signer";
import { getFile, putFile, removeFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Verify the signing OTP, stamp every page, append the certificate, store encrypted and lock. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadByToken(token);
  if (!ctx) return fail("This link is not valid.", 404);
  if (!ctx.authorised) return fail("Verify your mobile number first.", 401);
  const s = ctx.s;
  if (s.signedAt) return fail("This CSR is already signed.", 409);
  if (!s.draftKey || !s.photoKey || !s.consentAt) return fail("Finish the earlier steps first.", 409);

  const info = clientInfo(req);
  const body = await req.json().catch(() => ({}));
  const r = await verifyOtp(s.mobile, "SIGN", String(body.code ?? "").trim(), s.id);
  if (!r.ok) {
    await audit({ action: "SIGN_OTP_FAILED", actor: "SIGNATORY", projectId: s.projectId, signatoryId: s.id, ...info });
    return fail(r.error);
  }

  const signedAt = new Date();
  const documentId = `SQ-${s.centreCode.replace(/[^A-Za-z0-9]/g, "").slice(0, 10)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  const [draft, photo] = await Promise.all([getFile(s.draftKey), getFile(s.photoKey)]);
  const originalHash = s.draftHash ?? sha256(draft);

  const logs = await db.auditLog.findMany({ where: { signatoryId: s.id }, orderBy: { createdAt: "asc" } });
  const trail = logs
    .filter((l) => !["OTP_FAILED", "SIGN_OTP_FAILED"].includes(l.action))
    .map((l) => ({ at: fmtTimeIST(l.createdAt), what: actionText(l.action, l.details) }));
  trail.push({ at: fmtTimeIST(signedAt), what: "Signed with OTP · PDF sealed and stored encrypted" });

  const signed = await signPdf({
    draft: new Uint8Array(draft),
    photoJpeg: new Uint8Array(photo),
    documentId,
    originalHash,
    signer: { name: s.name, mobileMasked: maskMobile(s.mobile) },
    project: { name: s.project.name, exam: s.project.examName },
    centre: { code: s.centreCode, name: s.centreName },
    signedAtText: `${fmtIST(signedAt)} IST`,
    otp: { ref: r.ref, sentAtText: `${fmtTimeIST(r.sentAt)} IST`, verifiedAtText: `${fmtTimeIST(signedAt)} IST` },
    geo: s.geoLat != null && s.geoLng != null ? { lat: s.geoLat, lng: s.geoLng, accuracy: s.geoAccuracy } : null,
    photoAtText: s.photoAt ? `${fmtTimeIST(s.photoAt)} IST` : "",
    faceCheck: s.faceCheck ?? "unavailable",
    device: describeDevice(info.userAgent),
    ip: info.ip,
    trail,
  });

  const buf = Buffer.from(signed);
  const key = `projects/${s.projectId}/${s.id}/signed-${documentId}.pdf`;
  await putFile(key, buf);

  // Lock atomically: only the first successful signature wins.
  const res = await db.signatory.updateMany({
    where: { id: s.id, signedAt: null },
    data: {
      status: "SIGNED", signedAt, signedKey: key, signedHash: sha256(buf), documentId,
      otpRef: r.ref, otpSentAt: r.sentAt, otpVerifiedAt: signedAt, signIp: info.ip, signUserAgent: info.userAgent,
    },
  });
  if (res.count === 0) {
    await removeFile(key);
    return fail("This CSR is already signed.", 409);
  }
  await audit({ action: "SIGNED", actor: "SIGNATORY", projectId: s.projectId, signatoryId: s.id, details: { documentId, otpRef: r.ref, sha256: sha256(buf) }, ...info });
  return ok({ signed: true, documentId, signedAt, pages: s.draftPages });
}
