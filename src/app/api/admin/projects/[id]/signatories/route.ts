import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSignatories, requireAdmin, validateImport } from "@/lib/admin";
import { clientInfo, fail, ok } from "@/lib/http";

/** Add one signatory by hand. Same checks as CSV import. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  if (!(await db.project.findUnique({ where: { id } }))) return fail("Project not found", 404);
  const body = await req.json().catch(() => ({}));
  const { valid, issues } = await validateImport(id, [
    { name: body.name, mobile: body.mobile, centre_code: body.centreCode, centre_name: body.centreName },
  ]);
  if (issues.length) return fail(issues.map((i) => i.problem).join(" "), 400, { issues });
  await createSignatories(id, valid);
  await audit({ action: "SIGNATORY_ADDED", actor: "ADMIN", projectId: id, details: { centreCode: valid[0].centreCode, name: valid[0].name }, ...clientInfo(req) });
  return ok({ added: 1 });
}
