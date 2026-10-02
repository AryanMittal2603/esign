import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { projectStats, requireAdmin } from "@/lib/admin";
import { clientInfo, fail, ok } from "@/lib/http";

export async function GET() {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const projects = await db.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { signatories: { select: { status: true } } },
  });
  return ok({
    projects: projects.map((p) => ({
      id: p.id, name: p.name, examName: p.examName, examDate: p.examDate, shift: p.shift, createdAt: p.createdAt,
      stats: projectStats(p.signatories),
    })),
  });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (name.length < 3) return fail("Give the exam a name (at least 3 characters).");
  const clash = await db.project.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (clash) return fail(`An exam called "${clash.name}" already exists. Use a different name, e.g. add the shift or date.`, 409);
  const p = await db.project.create({
    data: {
      name,
      examName: String(body.examName ?? "").trim() || null,
      examDate: String(body.examDate ?? "").trim() || null,
      shift: String(body.shift ?? "").trim() || null,
      description: String(body.description ?? "").trim() || null,
    },
  });
  await audit({ action: "PROJECT_CREATED", actor: "ADMIN", projectId: p.id, details: { name }, ...clientInfo(req) });
  return ok({ id: p.id });
}
