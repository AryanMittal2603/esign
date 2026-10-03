import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientInfo, fail, ok, fileResponse } from "@/lib/http";
import { loadByToken } from "@/lib/signer";
import { getFile, putFile, removeFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Live camera photo (the visual signature) with GPS. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadByToken(token);
  if (!ctx) return fail("This link is not valid.", 404);
  if (!ctx.authorised) return fail("Verify your mobile number first.", 401);
  const s = ctx.s;
  if (s.signedAt) return fail("This CSR is already signed.", 409);
  if (!s.draftKey) return fail("Upload your CSR first.", 409);

  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!photo || typeof photo !== "object" || !("arrayBuffer" in photo)) return fail("No photo received.");
  if (photo.type !== "image/jpeg") return fail("Photo must be a JPEG from the live camera.");
  const bytes = Buffer.from(await photo.arrayBuffer());
  if (bytes.length < 2000) return fail("Photo looks empty. Please retake it.");

  const lat = Number(form?.get("lat"));
  const lng = Number(form?.get("lng"));
  const accuracy = Number(form?.get("accuracy"));
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  if (!hasGeo) return fail("Location is required. Allow location access and try again.");
  const face = form?.get("face") === "passed" ? "passed" : "unavailable";
  const liveness = form?.get("liveness") === "passed" ? "passed" : "unavailable";

  const key = `projects/${s.projectId}/${s.id}/photo-${Date.now()}.jpg`;
  await putFile(key, bytes);
  if (s.photoKey) await removeFile(s.photoKey);
  const at = new Date();
  await db.signatory.update({
    where: { id: s.id },
    data: { photoKey: key, photoAt: at, faceCheck: face, liveness, geoLat: lat, geoLng: lng, geoAccuracy: Number.isFinite(accuracy) ? accuracy : null },
  });
  await audit({
    action: "PHOTO_CAPTURED", actor: "SIGNATORY", projectId: s.projectId, signatoryId: s.id,
    details: { lat, lng, accuracy: Number.isFinite(accuracy) ? accuracy : null, face, liveness }, ...clientInfo(req),
  });
  return ok({ at, face, liveness });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await loadByToken(token);
  if (!ctx?.authorised || !ctx.s.photoKey) return fail("Not found", 404);
  const bytes = await getFile(ctx.s.photoKey);
  return fileResponse(new Uint8Array(bytes), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
}
