import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin";
import { clientInfo, fail, ok } from "@/lib/http";
import { linkSmsAvailable, sendLinkSms, signingLink } from "@/lib/sms";
import { sendWhatsAppInvite, whatsappReady } from "@/lib/whatsapp";
import { recordFailedSend, recordSent } from "@/lib/messages";

export const maxDuration = 300;

/**
 * Send the secure link to signatories.
 * body.ids: specific signatories · body.scope: "unsent" (never sent) | "pending" (all not yet signed)
 * body.channel: "whatsapp" | "sms" — defaults to WhatsApp when Gupshup is configured.
 * Large sends are batched: each call handles up to BATCH signatories (ordered by id, after body.after)
 * and returns `next` + `remaining`; the dashboard keeps calling until remaining is 0.
 */
const BATCH = 200;
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const info = clientInfo(req);

  const channel: "whatsapp" | "sms" = body.channel === "sms" ? "sms" : body.channel === "whatsapp" ? "whatsapp" : whatsappReady() ? "whatsapp" : "sms";
  if (channel === "whatsapp" && !whatsappReady()) return fail("WhatsApp is not configured.");
  if (channel === "sms" && !linkSmsAvailable()) return fail("SMS for links is not configured.");

  const project = await db.project.findUnique({ where: { id } });
  if (!project) return fail("Exam not found", 404);

  const where: Record<string, unknown> = { projectId: id, signedAt: null };
  if (Array.isArray(body.ids) && body.ids.length) where.id = { in: body.ids.slice(0, BATCH).map(String) };
  else if (body.scope === "unsent") where.status = "IMPORTED";
  const after = typeof body.after === "string" && body.after ? body.after : null;
  const pageWhere = after ? { ...where, id: { gt: after } } : where;
  const targets = await db.signatory.findMany({ where: pageWhere, orderBy: { id: "asc" }, take: BATCH });
  if (!targets.length) return after ? ok({ sent: 0, failed: 0, remaining: 0, next: null }) : fail("Nobody to send to.");

  const via = channel === "whatsapp" ? "WhatsApp" : "SMS";
  const exam = project.examName || project.name;
  let sent = 0;
  let lastError = "";
  const queue = [...targets];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const link = signingLink(s.token);
      const r = channel === "whatsapp"
        ? await sendWhatsAppInvite(s.mobile, { exam, name: s.name, centre: s.centreCode, link, token: s.token })
        : await sendLinkSms(s.mobile, s.name, link);
      if (r.ok) {
        sent++;
        await db.signatory.update({
          where: { id: s.id },
          data: { linkSentAt: new Date(), linkSentVia: via, ...(s.status === "IMPORTED" ? { status: "SENT" } : {}) },
        });
        await recordSent(s, channel === "whatsapp" ? "WHATSAPP" : "SMS", "messageId" in r && typeof r.messageId === "string" ? r.messageId : undefined);
        await audit({ action: "LINK_SENT", actor: "ADMIN", projectId: id, signatoryId: s.id, details: { via, ...("messageId" in r && r.messageId ? { messageId: r.messageId } : {}) }, ...info });
      } else {
        lastError = r.error;
        await recordFailedSend(s, channel === "whatsapp" ? "WHATSAPP" : "SMS", r.error);
        await audit({ action: "LINK_SEND_FAILED", actor: "SYSTEM", projectId: id, signatoryId: s.id, details: { via, error: r.error }, ...info });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, targets.length) }, worker));
  const last = targets[targets.length - 1].id;
  const remaining = targets.length < BATCH ? 0 : await db.signatory.count({ where: { ...where, id: { gt: last } } });
  if (!sent && !after) return fail(lastError || "Could not send any messages.", 502);
  return ok({ sent, failed: targets.length - sent, via, remaining, next: remaining ? last : null, error: lastError || undefined });
}
