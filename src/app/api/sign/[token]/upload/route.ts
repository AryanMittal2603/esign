import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/crypto";
import { clientInfo, fail, ok } from "@/lib/http";
import { mergeToPdf, type UploadPart } from "@/lib/pdf";
import { loadByToken } from "@/lib/signer";
import { putFile, removeFile } from "@/lib/storage";

export const runtime = "nodejs";

const TYPES = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png"]);

/** Upload or scan the CSR: any number of PDF / JPG / PNG parts, merged into one PDF. Replaceable until signed. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadByToken(token);
  if (!ctx) return fail("This link is not valid.", 404);
  if (!ctx.authorised) return fail("Verify your mobile number first.", 401);
  if (ctx.s.signedAt) return fail("This CSR is already signed and cannot be changed.", 409);

  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => typeof f === "object" && "arrayBuffer" in f);
  if (!files.length) return fail("Add at least one page or file.");

  const parts: UploadPart[] = [];
  for (const f of files) {
    const type = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
    if (!TYPES.has(type)) return fail(`${f.name || "A file"} is not a PDF, JPG or PNG.`);
    parts.push({ bytes: new Uint8Array(await f.arrayBuffer()), type, name: f.name });
  }

  let merged;
  try {
    merged = await mergeToPdf(parts);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not read the files.");
  }

  const s = ctx.s;
  const key = `projects/${s.projectId}/${s.id}/draft-${Date.now()}.pdf`;
  const buf = Buffer.from(merged.bytes);
  await putFile(key, buf);
  const replaced = !!s.draftKey;
  if (s.draftKey) await removeFile(s.draftKey);

  await db.signatory.update({
    where: { id: s.id },
    data: {
      draftKey: key, draftPages: merged.pages, draftSize: buf.length, draftHash: sha256(buf), uploadedAt: new Date(),
      status: "UPLOADED", consentAt: null,
    },
  });
  await audit({
    action: replaced ? "CSR_REPLACED" : "CSR_UPLOADED", actor: "SIGNATORY", projectId: s.projectId, signatoryId: s.id,
    details: { pages: merged.pages, bytes: buf.length, files: files.length }, ...clientInfo(req),
  });
  return ok({ pages: merged.pages, size: buf.length });
}
