import type { Prisma } from "@prisma/client";
import { db } from "./db";

export async function audit(entry: {
  action: string;
  actor: "ADMIN" | "SIGNATORY" | "SYSTEM";
  projectId?: string | null;
  signatoryId?: string | null;
  details?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}) {
  await db.auditLog.create({
    data: {
      action: entry.action,
      actor: entry.actor,
      projectId: entry.projectId ?? null,
      signatoryId: entry.signatoryId ?? null,
      details: entry.details,
      ip: entry.ip,
      userAgent: entry.userAgent,
    },
  });
}
