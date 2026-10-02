import { fail } from "@/lib/http";
import { loadByToken } from "@/lib/signer";
import { getFile } from "@/lib/storage";

export const runtime = "nodejs";

/** The draft PDF exactly as it will be signed (for the review step). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadByToken(token);
  if (!ctx) return fail("This link is not valid.", 404);
  if (!ctx.authorised) return fail("Verify your mobile number first.", 401);
  if (!ctx.s.draftKey) return fail("No document uploaded yet.", 404);
  const bytes = await getFile(ctx.s.draftKey);
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store", "Content-Disposition": "inline" },
  });
}
