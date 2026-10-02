import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin";
import { clientInfo, fail, ok } from "@/lib/http";
import { linkMessage, signingLink } from "@/lib/sms";

/** Admin shares the link by WhatsApp from their own phone; we record it and hand back the wa.me URL. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const s = await db.signatory.findUnique({ where: { id } });
  if (!s) return fail("Not found", 404);
  if (s.signedAt) return fail("Already signed.", 409);
  await db.signatory.update({
    where: { id },
    data: { linkSentAt: new Date(), linkSentVia: "WhatsApp", ...(s.status === "IMPORTED" ? { status: "SENT" } : {}) },
  });
  await audit({ action: "LINK_SENT", actor: "ADMIN", projectId: s.projectId, signatoryId: s.id, details: { via: "WhatsApp" }, ...clientInfo(req) });
  const text = linkMessage(s.name, signingLink(s.token));
  return ok({ url: `https://wa.me/91${s.mobile}?text=${encodeURIComponent(text)}` });
}
