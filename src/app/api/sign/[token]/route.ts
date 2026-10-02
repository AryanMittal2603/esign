import { audit } from "@/lib/audit";
import { clientInfo, fail, ok } from "@/lib/http";
import { loadByToken, markOpenedAndVerified, serialise } from "@/lib/signer";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadByToken(token);
  if (!ctx) return fail("This link is not valid.", 404);

  const changed = await markOpenedAndVerified(ctx.s, ctx.authorised);
  if (changed.openedAt) {
    await audit({ action: "LINK_OPENED", actor: "SIGNATORY", projectId: ctx.s.projectId, signatoryId: ctx.s.id, ...clientInfo(req) });
  }
  Object.assign(ctx.s, changed);
  return ok(serialise(ctx));
}
