import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
const db = new PrismaClient();
const p = await db.project.create({ data: { name: "LOAD TEST 10K", examName: "Load test exam", examDate: "12 Oct 2026", shift: "Shift 1" } });
const statuses = ["SIGNED", "SIGNED", "SIGNED", "UPLOADED", "VERIFIED", "OPENED", "SENT", "IMPORTED"] as const;
const rows = Array.from({ length: 10000 }, (_, i) => {
  const st = statuses[i % statuses.length];
  const now = Date.now() - (i % 120) * 60000;
  return {
    projectId: p.id, name: `Signatory ${String(i + 1).padStart(5, "0")}`, mobile: String(7000000000 + i), centreCode: `C${String(i + 1).padStart(5, "0")}`,
    centreName: `Government Inter College Number ${i + 1}, District ${(i % 75) + 1}, Uttar Pradesh`, token: crypto.randomBytes(24).toString("base64url"), status: st,
    linkSentAt: st === "IMPORTED" ? null : new Date(now - 3600e3), linkSentVia: st === "IMPORTED" ? null : "WhatsApp",
    signedAt: st === "SIGNED" ? new Date(now) : null, documentId: st === "SIGNED" ? `SQ-L${i}` : null,
    geoLat: st === "SIGNED" ? 26.8 + (i % 100) / 1000 : null, geoLng: st === "SIGNED" ? 80.9 + (i % 100) / 1000 : null,
  };
});
for (let i = 0; i < rows.length; i += 2000) await db.signatory.createMany({ data: rows.slice(i, i + 2000) });
console.log(p.id);
await db.$disconnect();
