import { db } from "@/lib/db";
import { projectStats, requireAdmin } from "@/lib/admin";
import { fail, ok } from "@/lib/http";
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
