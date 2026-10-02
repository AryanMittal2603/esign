import { db } from "@/lib/db";
import { clearSignerSession, getSignerMobile } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { maskMobile } from "@/lib/format";

/** Reports for the verified mobile number (direct access without a link). */
export async function GET() {
  const mobile = await getSignerMobile();
  if (!mobile) return fail("Not verified", 401);
  const rows = await db.signatory.findMany({
    where: { mobile },
    include: { project: true },
    orderBy: { createdAt: "desc" },
  });
  return ok({
    mobileMasked: maskMobile(mobile),
    name: rows[0]?.name ?? "",
    reports: rows.map((s) => ({
      token: s.token,
      status: s.status,
      project: s.project.name,
      exam: s.project.examName,
      date: s.project.examDate,
      shift: s.project.shift,
      centreCode: s.centreCode,
      centreName: s.centreName,
      signedAt: s.signedAt,
    })),
  });
}

export async function DELETE() {
  await clearSignerSession();
  return ok({ signedOut: true });
}
