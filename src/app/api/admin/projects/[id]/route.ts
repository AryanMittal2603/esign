import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { removeIncomingFor, removePrefix } from "@/lib/storage";
import { requireAdmin, statsByProject } from "@/lib/admin";
import { clientInfo, fail, ok } from "@/lib/http";
import { linkSmsAvailable, smsMode } from "@/lib/sms";
import { whatsappReady } from "@/lib/whatsapp";

/**
 * Exam summary for the live tracker. Never returns the full signatory list (that is paged via
 * /signatories), so the payload stays small at any size.
 * wall: one character per signatory in centre-code order — S signed · U uploaded · O opened · L link sent · N not sent.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const p = await db.project.findUnique({ where: { id } });
  if (!p) return fail("Exam not found", 404);

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [statsOf, recent, lastHour, statuses, delivery] = await Promise.all([
    statsByProject([id]),
    db.signatory.findMany({
      where: { projectId: id, signedAt: { not: null } },
      orderBy: { signedAt: "desc" }, take: 6,
      select: { id: true, name: true, centreCode: true, centreName: true, signedAt: true },
    }),
    db.signatory.count({ where: { projectId: id, signedAt: { gt: hourAgo } } }),
    db.signatory.findMany({ where: { projectId: id }, orderBy: { centreCode: "asc" }, select: { status: true } }),
    db.signatory.groupBy({ by: ["msgStatus"], where: { projectId: id, msgChannel: "WHATSAPP" }, _count: { _all: true } }),
  ]);
  const msg: Record<string, number> = {};
  for (const d of delivery) if (d.msgStatus) msg[d.msgStatus] = d._count._all;
  const code: Record<string, string> = { SIGNED: "S", UPLOADED: "U", VERIFIED: "O", OPENED: "O", SENT: "L", IMPORTED: "N" };

  return ok({
    project: { id: p.id, name: p.name, examName: p.examName, examDate: p.examDate, shift: p.shift, createdAt: p.createdAt },
    stats: statsOf(id),
    recent,
    lastHour,
    sms: { mode: smsMode(), linkSms: linkSmsAvailable(), whatsapp: whatsappReady() },
    wall: statuses.map((s) => code[s.status]).join(""),
    // latest WhatsApp invitation per signatory: how far it got
    delivery: {
      total: Object.values(msg).reduce((a, b) => a + b, 0),
      delivered: (msg.delivered ?? 0) + (msg.read ?? 0),
      read: msg.read ?? 0,
      failed: msg.failed ?? 0,
      pending: (msg.submitted ?? 0) + (msg.enqueued ?? 0) + (msg.sent ?? 0),
    },
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
