import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin";
import { actionText } from "@/lib/actions";
import { clientInfo, describeDevice, fail, ok } from "@/lib/http";
import { signingLink } from "@/lib/sms";
import { removeFile } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const s = await db.signatory.findUnique({
    where: { id },
    include: { project: true, auditLogs: { orderBy: { createdAt: "asc" } } },
  });
  if (!s) return fail("Not found", 404);
  return ok({
    id: s.id, name: s.name, mobile: s.mobile, centreCode: s.centreCode, centreName: s.centreName, status: s.status,
    project: { id: s.project.id, name: s.project.name },
    link: signingLink(s.token),
    linkSentAt: s.linkSentAt, openedAt: s.openedAt, verifiedAt: s.verifiedAt, uploadedAt: s.uploadedAt, pages: s.draftPages,
    photoAt: s.photoAt, faceCheck: s.faceCheck, geo: s.geoLat != null ? { lat: s.geoLat, lng: s.geoLng, accuracy: s.geoAccuracy } : null,
    signedAt: s.signedAt, documentId: s.documentId, otpRef: s.otpRef, signedHash: s.signedHash,
    device: s.signUserAgent ? describeDevice(s.signUserAgent) : null, signIp: s.signIp,
    hasPhoto: !!s.photoKey, hasDraft: !!s.draftKey, hasSigned: !!s.signedKey,
    events: s.auditLogs.map((l) => ({ at: l.createdAt, action: l.action, text: actionText(l.action, l.details), actor: l.actor, ip: l.ip })),
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const s = await db.signatory.findUnique({ where: { id } });
  if (!s) return fail("Not found", 404);
  if (s.signedAt) return fail("A signed CSR cannot be removed.", 409);
  for (const key of [s.draftKey, s.photoKey]) if (key) await removeFile(key);
  await db.signatory.delete({ where: { id } });
  await audit({ action: "SIGNATORY_REMOVED", actor: "ADMIN", projectId: s.projectId, details: { centreCode: s.centreCode, name: s.name }, ...clientInfo(req) });
  return ok({ removed: true });
}
