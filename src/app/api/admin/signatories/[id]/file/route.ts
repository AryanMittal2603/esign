import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin";
import { clientInfo, fail, fileResponse } from "@/lib/http";
import { getFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

/** ?kind=signed | draft | photo */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const kind = new URL(req.url).searchParams.get("kind") ?? "signed";
  const s = await db.signatory.findUnique({ where: { id } });
  if (!s) return fail("Not found", 404);

  const key = kind === "photo" ? s.photoKey : kind === "draft" ? s.draftKey : s.signedKey;
  if (!key) return fail("File not available", 404);
  const bytes = await getFile(key);
  if (kind === "photo") return fileResponse(new Uint8Array(bytes), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });

  if (kind === "signed") await audit({ action: "SIGNED_DOWNLOADED", actor: "ADMIN", projectId: s.projectId, signatoryId: s.id, ...clientInfo(req) });
  const name = kind === "signed" ? `${s.documentId}.pdf` : `draft-${s.centreCode}.pdf`;
  return fileResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
