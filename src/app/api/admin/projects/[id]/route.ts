import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { incomingPrefix, removePrefix } from "@/lib/storage";
import { projectStats, requireAdmin } from "@/lib/admin";
import { clientInfo, fail, ok } from "@/lib/http";
import { linkSmsAvailable, signingLink, smsMode } from "@/lib/sms";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const p = await db.project.findUnique({
    where: { id },
    include: { signatories: { orderBy: [{ centreCode: "asc" }] } },
  });
  if (!p) return fail("Project not found", 404);

  const recent = p.signatories
    .filter((s) => s.signedAt)
    .sort((a, b) => b.signedAt!.getTime() - a.signedAt!.getTime())
    .slice(0, 6)
    .map((s) => ({ id: s.id, name: s.name, centreCode: s.centreCode, centreName: s.centreName, signedAt: s.signedAt }));

  // signing pace over the last 60 minutes
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const lastHour = p.signatories.filter((s) => s.signedAt && s.signedAt.getTime() > hourAgo).length;

  return ok({
    project: { id: p.id, name: p.name, examName: p.examName, examDate: p.examDate, shift: p.shift, createdAt: p.createdAt },
    stats: projectStats(p.signatories),
    recent,
    lastHour,
    sms: { mode: smsMode(), linkSms: linkSmsAvailable() },
    signatories: p.signatories.map((s) => ({
      id: s.id, name: s.name, mobile: s.mobile, centreCode: s.centreCode, centreName: s.centreName, status: s.status,
      link: signingLink(s.token), linkSentAt: s.linkSentAt, linkSentVia: s.linkSentVia, openedAt: s.openedAt,
      uploadedAt: s.uploadedAt, pages: s.draftPages, signedAt: s.signedAt, documentId: s.documentId,
      geoLat: s.geoLat, geoLng: s.geoLng, hasPhoto: !!s.photoKey,
    })),
  });
}

/**
 * Permanently deletes a project: every stored file (drafts, photos, signed PDFs, unfinished uploads),
 * its signatories, OTPs and audit log. body.confirm must equal the project name.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const p = await db.project.findUnique({ where: { id }, include: { signatories: { select: { id: true, signedAt: true } } } });
  if (!p) return fail("Project not found", 404);
  const body = await req.json().catch(() => ({}));
  if (String(body.confirm ?? "").trim() !== p.name.trim()) return fail("Type the project name exactly to confirm.");

  const ids = p.signatories.map((s) => s.id);
  let files = 0;
  try {
    files += await removePrefix(`projects/${id}/`);
    for (const sid of ids) files += await removePrefix(incomingPrefix(sid));
  } catch (e) {
    return fail(`Could not delete stored files, nothing was removed from the database. ${e instanceof Error ? e.message : ""}`, 502);
  }

  await db.$transaction([
    db.otp.deleteMany({ where: { signatoryId: { in: ids } } }),
    db.project.delete({ where: { id } }), // cascades to signatories and the project's audit log
  ]);
  await audit({
    action: "PROJECT_DELETED", actor: "ADMIN",
    details: { name: p.name, signatories: ids.length, signed: p.signatories.filter((s) => s.signedAt).length, files },
    ...clientInfo(req),
  });
  return ok({ deleted: true, signatories: ids.length, files });
}
