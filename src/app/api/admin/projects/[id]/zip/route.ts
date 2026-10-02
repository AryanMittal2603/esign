import JSZip from "jszip";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin";
import { clientInfo, fail } from "@/lib/http";
import { getFile } from "@/lib/storage";

export const runtime = "nodejs";

/** Every signed CSR in the project, one PDF per centre. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const p = await db.project.findUnique({ where: { id }, include: { signatories: { where: { signedKey: { not: null } }, orderBy: { centreCode: "asc" } } } });
  if (!p) return fail("Project not found", 404);
  if (!p.signatories.length) return fail("No signed CSRs yet.", 404);

  const zip = new JSZip();
  for (const s of p.signatories) {
    const safe = s.centreName.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 60);
    zip.file(`${s.centreCode}_${safe}_${s.documentId}.pdf`, await getFile(s.signedKey!));
  }
  const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  await audit({ action: "EXPORT_ZIP", actor: "ADMIN", projectId: id, details: { files: p.signatories.length }, ...clientInfo(req) });
  const file = `${p.name.replace(/[^A-Za-z0-9]+/g, "_")}_signed_CSRs.zip`;
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${file}"` } });
}
