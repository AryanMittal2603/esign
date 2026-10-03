import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { removeIncomingFor, removePrefix } from "@/lib/storage";
import { requireAdmin, statsByProject } from "@/lib/admin";
import { clientInfo, fail, ok } from "@/lib/http";
import { linkSmsAvailable, smsMode } from "@/lib/sms";
import { whatsappReady } from "@/lib/whatsapp";

/**
 * Exam summary for the live tracker: totals plus counts for the CSR and delivery filters.
 * Never returns the signatory list (that is paged via /signatories), so it stays small at any size.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const p = await db.project.findUnique({ where: { id } });
  if (!p) return fail("Exam not found", 404);

  const [statsOf, deliveryRows, neverSent] = await Promise.all([
    statsByProject([id]),
    db.signatory.groupBy({ by: ["msgStatus"], where: { projectId: id }, _count: { _all: true } }),
    db.signatory.count({ where: { projectId: id, linkSentAt: null, msgStatus: null } }),
  ]);
  const stats = statsOf(id);
  const m: Record<string, number> = {};
  for (const d of deliveryRows) m[d.msgStatus ?? "none"] = d._count._all;
  const delivery = {
    notsent: neverSent,
    sending: (m.submitted ?? 0) + (m.enqueued ?? 0),
    sent: (m.sent ?? 0) + ((m.none ?? 0) - neverSent), // includes links shared before tracking existed
    delivered: m.delivered ?? 0,
    read: m.read ?? 0,
    failed: m.failed ?? 0,
  };
  const b = stats.byStatus;
  const csr = { notstarted: b.IMPORTED + b.SENT, opened: b.OPENED + b.VERIFIED, uploaded: b.UPLOADED, signed: b.SIGNED };

  return ok({
    project: { id: p.id, name: p.name, examName: p.examName, examDate: p.examDate, shift: p.shift, createdAt: p.createdAt },
    stats,
    counts: { csr, delivery },
    sms: { mode: smsMode(), linkSms: linkSmsAvailable(), whatsapp: whatsappReady() },
    webhook: !!process.env.GUPSHUP_WEBHOOK_KEY,
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
    files += await removeIncomingFor(new Set(ids));
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
