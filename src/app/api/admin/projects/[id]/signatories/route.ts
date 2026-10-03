import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSignatories, listWhere, requireAdmin, validateImport, type ListTab } from "@/lib/admin";
import { signingLink } from "@/lib/sms";
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

/**
 * Paged signatory list for the exam table.
 * ?tab=all|signed|pending|unsent · ?q=search · ?page=0 · ?size=50 (max 100)
 * ?at=<index> returns just the id at that position in centre-code order (used by the signatory wall).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const url = new URL(req.url);

  const at = url.searchParams.get("at");
  if (at !== null) {
    const row = await db.signatory.findFirst({ where: { projectId: id }, orderBy: { centreCode: "asc" }, skip: Math.max(0, Number(at) || 0), select: { id: true } });
    return row ? ok({ id: row.id }) : fail("Not found", 404);
  }

  const tabs: ListTab[] = ["all", "signed", "pending", "unsent", "failed"];
  const tab = (tabs.includes(url.searchParams.get("tab") as ListTab) ? url.searchParams.get("tab") : "all") as ListTab;
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  const size = Math.min(100, Math.max(10, Number(url.searchParams.get("size")) || 50));
  const page = Math.max(0, Number(url.searchParams.get("page")) || 0);
  const where = listWhere(id, tab, q);

  const [total, rows] = await Promise.all([
    db.signatory.count({ where }),
    db.signatory.findMany({
      where, orderBy: { centreCode: "asc" }, skip: page * size, take: size,
      select: { id: true, name: true, mobile: true, centreCode: true, centreName: true, status: true, token: true, linkSentAt: true, linkSentVia: true, signedAt: true, geoLat: true, geoLng: true, msgChannel: true, msgStatus: true, msgStatusAt: true, msgError: true },
    }),
  ]);
  return ok({
    total, page, size,
    rows: rows.map(({ token, ...r }) => ({ ...r, link: signingLink(token) })),
  });
}
