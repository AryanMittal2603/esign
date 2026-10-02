import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSignatories, requireAdmin, validateImport } from "@/lib/admin";
import { clientInfo, fail, ok } from "@/lib/http";

/** { rows, commit } — validate always; when commit is true, save the valid rows. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  if (!(await db.project.findUnique({ where: { id } }))) return fail("Project not found", 404);
  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : [];
  if (!rows.length) return fail("The file has no rows.");
  if (rows.length > 20000) return fail("Up to 20,000 rows per file.");

  const result = await validateImport(id, rows);
  if (!body.commit) {
    // cap the list sent to the browser; the count and downloadable report cover the rest
    return ok({ total: result.total, valid: result.valid.length, issueCount: result.issues.length, badRows: new Set(result.issues.map((i) => i.row)).size, issues: body.full ? result.issues : result.issues.slice(0, 500), preview: result.valid.slice(0, 5) });
  }

  const added = await createSignatories(id, result.valid);
  await audit({ action: "SIGNATORIES_IMPORTED", actor: "ADMIN", projectId: id, details: { count: added, skipped: result.issues.length }, ...clientInfo(req) });
  return ok({ added, skipped: new Set(result.issues.map((i) => i.row)).size });
}
