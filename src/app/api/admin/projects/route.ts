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

const clean = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");

/** "2026-10-12" (date input) or free text → "12 Oct 2026", so the same day always compares equal. */
function normaliseDate(v: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

/** "2" or "shift 2" → "Shift 2"; anything else is kept as typed. */
function normaliseShift(v: string): string {
  const m = /^(?:shift\s*)?(\d+)$/i.exec(v);
  return m ? `Shift ${m[1]}` : v;
}

/** Exam, date and shift are required; together they must be unique. Name is optional. */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const body = await req.json().catch(() => ({}));
  const examName = clean(body.examName);
  const shift = normaliseShift(clean(body.shift));
  const examDate = clean(body.examDate) ? normaliseDate(clean(body.examDate)) : null;
  if (examName.length < 2) return fail("Enter the exam.");
  if (!examDate) return fail("Pick the exam date.");
  if (!shift) return fail("Enter the shift.");

  const clash = await db.project.findFirst({
    where: {
      examName: { equals: examName, mode: "insensitive" },
      examDate,
      shift: { equals: shift, mode: "insensitive" },
    },
  });
  if (clash) return fail(`${clash.examName} on ${clash.examDate}, ${clash.shift} already exists (“${clash.name}”).`, 409);

  const name = clean(body.name) || `${examName} · ${shift}`;
  const p = await db.project.create({
    data: { name, examName, examDate, shift, description: clean(body.description) || null },
  });
  await audit({ action: "PROJECT_CREATED", actor: "ADMIN", projectId: p.id, details: { name, examName, examDate, shift }, ...clientInfo(req) });
  return ok({ id: p.id });
}
