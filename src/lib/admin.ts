import { getAdmin } from "./auth";
import { db } from "./db";
import { MOBILE_RE, normaliseMobile } from "./http";
import { randomToken } from "./crypto";

export async function requireAdmin(): Promise<string | null> {
  const a = await getAdmin();
  return a?.sub ?? null;
}

export type ImportRow = { name?: string; mobile?: string; centre_code?: string; centre_name?: string };
export type ImportIssue = { row: number; field: string; value: string; problem: string };

const ALIASES: Record<string, keyof ImportRow> = {
  name: "name", signatory: "name", signatory_name: "name",
  mobile: "mobile", mobile_number: "mobile", phone: "mobile", signatory_number: "mobile",
  centre_code: "centre_code", center_code: "centre_code", code: "centre_code",
  centre_name: "centre_name", center_name: "centre_name", centre: "centre_name", center: "centre_name",
};

export function normaliseRow(raw: Record<string, unknown>): ImportRow {
  const out: ImportRow = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = ALIASES[k.trim().toLowerCase().replace(/[\s-]+/g, "_")];
    if (key) out[key] = String(v ?? "").trim();
  }
  return out;
}

/** Validates rows against each other and against what the project already holds. Row numbers match the file (header = row 1). */
export async function validateImport(projectId: string, rawRows: Record<string, unknown>[]) {
  const existing = await db.signatory.findMany({ where: { projectId }, select: { mobile: true, centreCode: true } });
  const takenMobile = new Set(existing.map((e) => e.mobile));
  const takenCode = new Set(existing.map((e) => e.centreCode.toLowerCase()));
  const seenMobile = new Map<string, number>();
  const seenCode = new Map<string, number>();
  const issues: ImportIssue[] = [];
  const valid: { name: string; mobile: string; centreCode: string; centreName: string }[] = [];

  rawRows.forEach((raw, i) => {
    const rowNo = i + 2;
    const r = normaliseRow(raw);
    if (!Object.values(r).some((v) => v)) return; // blank line
    const rowIssues: ImportIssue[] = [];
    const mobile = normaliseMobile(r.mobile);
    const code = (r.centre_code ?? "").trim();

    if (!r.name) rowIssues.push({ row: rowNo, field: "name", value: "(empty)", problem: "Signatory name is missing." });
    if (!r.mobile) rowIssues.push({ row: rowNo, field: "mobile", value: "(empty)", problem: "Mobile number is missing." });
    else if (!MOBILE_RE.test(mobile)) rowIssues.push({ row: rowNo, field: "mobile", value: r.mobile, problem: `Mobile must be a 10-digit Indian number${mobile.length && mobile.length !== 10 ? `. This one has ${mobile.length} digits` : ""}.` });
    else if (takenMobile.has(mobile)) rowIssues.push({ row: rowNo, field: "mobile", value: r.mobile, problem: "This number already has a CSR in this project." });
    else if (seenMobile.has(mobile)) rowIssues.push({ row: rowNo, field: "mobile", value: r.mobile, problem: `Same number as row ${seenMobile.get(mobile)}. One CSR per mobile in a project.` });
    if (!code) rowIssues.push({ row: rowNo, field: "centre_code", value: "(empty)", problem: "Centre code is missing." });
    else if (takenCode.has(code.toLowerCase())) rowIssues.push({ row: rowNo, field: "centre_code", value: code, problem: "This centre is already in the project." });
    else if (seenCode.has(code.toLowerCase())) rowIssues.push({ row: rowNo, field: "centre_code", value: code, problem: `Centre ${code} also appears on row ${seenCode.get(code.toLowerCase())}. Keep one row per centre.` });
    if (!r.centre_name) rowIssues.push({ row: rowNo, field: "centre_name", value: "(empty)", problem: "Centre name is missing." });

    if (MOBILE_RE.test(mobile) && !seenMobile.has(mobile)) seenMobile.set(mobile, rowNo);
    if (code && !seenCode.has(code.toLowerCase())) seenCode.set(code.toLowerCase(), rowNo);

    if (rowIssues.length) issues.push(...rowIssues);
    else valid.push({ name: r.name!, mobile, centreCode: code, centreName: r.centre_name! });
  });

  const badRows = new Set(issues.map((x) => x.row)).size;
  return { valid, issues, total: valid.length + badRows };
}

export async function createSignatories(projectId: string, rows: { name: string; mobile: string; centreCode: string; centreName: string }[]) {
  if (!rows.length) return 0;
  const res = await db.signatory.createMany({
    data: rows.map((r) => ({ ...r, projectId, token: randomToken() })),
    skipDuplicates: true,
  });
  return res.count;
}

export type StatusCounts = Record<"IMPORTED" | "SENT" | "OPENED" | "VERIFIED" | "UPLOADED" | "SIGNED", number>;

export function statsFromCounts(c: Partial<StatusCounts>) {
  const n = (k: keyof StatusCounts) => c[k] ?? 0;
  const total = n("IMPORTED") + n("SENT") + n("OPENED") + n("VERIFIED") + n("UPLOADED") + n("SIGNED");
  const opened = n("OPENED") + n("VERIFIED") + n("UPLOADED") + n("SIGNED");
  const uploaded = n("UPLOADED") + n("SIGNED");
  const byStatus = { IMPORTED: n("IMPORTED"), SENT: n("SENT"), OPENED: n("OPENED"), VERIFIED: n("VERIFIED"), UPLOADED: n("UPLOADED"), SIGNED: n("SIGNED") };
  return { total, sent: total - n("IMPORTED"), opened, uploaded, signed: n("SIGNED"), pending: total - n("SIGNED"), byStatus };
}

/** Status counts per exam via one GROUP BY (no rows loaded), so it stays fast at any size. */
export async function statsByProject(projectIds?: string[]) {
  const rows = await db.signatory.groupBy({
    by: ["projectId", "status"],
    where: projectIds ? { projectId: { in: projectIds } } : undefined,
    _count: { _all: true },
  });
  const map = new Map<string, Partial<StatusCounts>>();
  for (const r of rows) {
    const m = map.get(r.projectId) ?? {};
    m[r.status] = r._count._all;
    map.set(r.projectId, m);
  }
  return (id: string) => statsFromCounts(map.get(id) ?? {});
}

/** Signatory list filters shared by the table, the wall and exports. */
export type ListTab = "all" | "signed" | "pending" | "unsent";
export function listWhere(projectId: string, tab: ListTab, q: string) {
  const where: Record<string, unknown> = { projectId };
  if (tab === "signed") where.status = "SIGNED";
  else if (tab === "pending") where.status = { not: "SIGNED" };
  else if (tab === "unsent") where.status = "IMPORTED";
  const needle = q.trim();
  if (needle) {
    where.OR = [
      { name: { contains: needle, mode: "insensitive" } },
      { centreCode: { contains: needle, mode: "insensitive" } },
      { centreName: { contains: needle, mode: "insensitive" } },
      { mobile: { contains: needle.replace(/\D/g, "") || needle } },
    ];
  }
  return where;
}
