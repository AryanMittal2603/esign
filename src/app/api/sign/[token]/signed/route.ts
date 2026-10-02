import { audit } from "@/lib/audit";
import { clientInfo, fail } from "@/lib/http";
import { loadByToken } from "@/lib/signer";
import { getFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadByToken(token);
  if (!ctx) return fail("This link is not valid.", 404);
  if (!ctx.authorised) return fail("Verify your mobile number first.", 401);
  if (!ctx.s.signedKey) return fail("Not signed yet.", 404);
  const bytes = await getFile(ctx.s.signedKey);
  await audit({ action: "SIGNED_DOWNLOADED", actor: "SIGNATORY", projectId: ctx.s.projectId, signatoryId: ctx.s.id, ...clientInfo(req) });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ctx.s.documentId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
