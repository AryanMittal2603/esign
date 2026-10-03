import type { Project, Signatory } from "@prisma/client";
import { db } from "./db";
import { getSignerMobile } from "./auth";
import { maskMobile } from "./format";
import { incomingPrefix, storageDriver } from "./storage";

export type SignerCtx = { s: Signatory & { project: Project }; authorised: boolean; mobile: string | null };

export async function loadByToken(token: string): Promise<SignerCtx | null> {
  if (!token || token.length > 80) return null;
  const s = await db.signatory.findUnique({ where: { token }, include: { project: true } });
  if (!s) return null;
  const mobile = await getSignerMobile();
  return { s, authorised: mobile === s.mobile, mobile };
}

/** What the signing page needs. Only the public part is returned before OTP verification. */
export function serialise(ctx: SignerCtx) {
  const { s } = ctx;
  const pub = {
    authorised: ctx.authorised,
    project: { name: s.project.name, exam: s.project.examName, date: s.project.examDate, shift: s.project.shift },
    centreCode: s.centreCode,
    mobileMasked: maskMobile(s.mobile),
  };
  if (!ctx.authorised) return pub;
  return {
    ...pub,
    name: s.name,
    centreName: s.centreName,
    status: s.status,
    draft: s.draftKey ? { pages: s.draftPages, size: s.draftSize, uploadedAt: s.uploadedAt } : null,
    photo: s.photoKey ? { at: s.photoAt, lat: s.geoLat, lng: s.geoLng, accuracy: s.geoAccuracy, face: s.faceCheck, liveness: s.liveness } : null,
    consentAt: s.consentAt,
    signed: s.signedAt ? { at: s.signedAt, documentId: s.documentId, pages: s.draftPages } : null,
    // On Vercel the browser uploads scans straight to private Blob storage (no 4.5 MB request limit).
    directUpload: storageDriver() === "blob" ? { prefix: incomingPrefix(s.id) } : null,
  };
}

export async function markOpenedAndVerified(s: Signatory, verified: boolean) {
  const data: Partial<Signatory> = {};
  if (!s.openedAt) data.openedAt = new Date();
  if (verified && !s.verifiedAt) data.verifiedAt = new Date();
  const rank = ["IMPORTED", "SENT", "OPENED", "VERIFIED", "UPLOADED", "SIGNED"];
  const target = verified ? "VERIFIED" : "OPENED";
  if (rank.indexOf(s.status) < rank.indexOf(target)) data.status = target as Signatory["status"];
  if (Object.keys(data).length) await db.signatory.update({ where: { id: s.id }, data });
  return data;
}
