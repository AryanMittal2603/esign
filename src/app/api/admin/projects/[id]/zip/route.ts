import JSZip from "jszip";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin";
import { clientInfo, fail, fileResponse } from "@/lib/http";
import { getFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Signed PDFs per ZIP part — keeps each download within function memory and time limits. */
const ZIP_PART_SIZE = 200;

/** Signed CSRs as ZIP, in parts of ZIP_PART_SIZE (?part=1, 2, …) ordered by centre code. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const p = await db.project.findUnique({ where: { id } });
  if (!p) return fail("Exam not found", 404);

  const signedWhere = { projectId: id, signedKey: { not: null } };
  const total = await db.signatory.count({ where: signedWhere });
  if (!total) return fail("No signed CSRs yet.", 404);
  const parts = Math.ceil(total / ZIP_PART_SIZE);
  const part = Math.min(parts, Math.max(1, Number(new URL(req.url).searchParams.get("part")) || 1));

  const rows = await db.signatory.findMany({
    where: signedWhere, orderBy: { centreCode: "asc" }, skip: (part - 1) * ZIP_PART_SIZE, take: ZIP_PART_SIZE,
    select: { centreCode: true, centreName: true, documentId: true, signedKey: true },
  });

  const zip = new JSZip();
  // fetch a few files at a time instead of all at once
  for (let i = 0; i < rows.length; i += 8) {
    const chunk = rows.slice(i, i + 8);
    const files = await Promise.all(chunk.map((s) => getFile(s.signedKey!)));
    chunk.forEach((s, j) => {
      const safe = s.centreName.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 60);
      zip.file(`${s.centreCode}_${safe}_${s.documentId}.pdf`, files[j]);
    });
  }
  const buf = await zip.generateAsync({ type: "uint8array", compression: "STORE" }); // PDFs are already compressed
  await audit({ action: "EXPORT_ZIP", actor: "ADMIN", projectId: id, details: { files: rows.length, part, parts }, ...clientInfo(req) });
  const base = p.name.replace(/[^A-Za-z0-9]+/g, "_");
  const file = parts > 1 ? `${base}_signed_CSRs_part${part}of${parts}.zip` : `${base}_signed_CSRs.zip`;
  return fileResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${file}"` } });
}
