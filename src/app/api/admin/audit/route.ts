import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { actionText } from "@/lib/actions";
import { fail, ok } from "@/lib/http";

export async function GET(req: Request) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") || undefined;
  const before = url.searchParams.get("before");
  const take = Math.min(200, Number(url.searchParams.get("limit") ?? 100) || 100);
  const logs = await db.auditLog.findMany({
    where: { projectId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: "desc" },
    take,
    include: { project: { select: { name: true } }, signatory: { select: { name: true, centreCode: true } } },
  });
  return ok({
    logs: logs.map((l) => ({
      id: l.id, at: l.createdAt, actor: l.actor, action: l.action, text: actionText(l.action, l.details),
      project: l.project?.name ?? null, signatory: l.signatory ? `${l.signatory.name} · ${l.signatory.centreCode}` : null, ip: l.ip,
    })),
    projects: await db.project.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
  });
}
