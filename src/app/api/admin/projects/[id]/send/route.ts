import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin";
import { clientInfo, fail, ok } from "@/lib/http";
import { sendLinkSms, signingLink } from "@/lib/sms";

/**
 * Send secure links by SMS.
 * body.ids: specific signatories · body.scope: "unsent" (never sent) | "pending" (all not yet signed)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const info = clientInfo(req);

  const where: Record<string, unknown> = { projectId: id, signedAt: null };
  if (Array.isArray(body.ids) && body.ids.length) where.id = { in: body.ids.map(String) };
  else if (body.scope === "unsent") where.status = "IMPORTED";
  const targets = await db.signatory.findMany({ where });
  if (!targets.length) return fail("Nobody to send to.");

  let sent = 0;
  let lastError = "";
  const queue = [...targets];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const r = await sendLinkSms(s.mobile, s.name, signingLink(s.token));
      if (r.ok) {
        sent++;
        await db.signatory.update({
          where: { id: s.id },
          data: { linkSentAt: new Date(), linkSentVia: "SMS", ...(s.status === "IMPORTED" ? { status: "SENT" } : {}) },
        });
        await audit({ action: "LINK_SENT", actor: "ADMIN", projectId: id, signatoryId: s.id, details: { via: "SMS" }, ...info });
      } else {
        lastError = r.error;
        await audit({ action: "LINK_SEND_FAILED", actor: "SYSTEM", projectId: id, signatoryId: s.id, details: { error: r.error }, ...info });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, targets.length) }, worker));
  if (!sent) return fail(lastError || "Could not send any links.", 502);
  return ok({ sent, failed: targets.length - sent, error: lastError || undefined });
}
