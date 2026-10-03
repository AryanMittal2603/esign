import { applyWebhook } from "@/lib/messages";
import { safeEqual } from "@/lib/crypto";

export const runtime = "nodejs";

/**
 * Gupshup delivery receipts (enqueued / sent / delivered / read / failed).
 * Accepts the Gupshup v2 and Meta v3 formats. Authenticate with the secret either as a callback
 * header `x-webhook-key: <GUPSHUP_WEBHOOK_KEY>` or in the URL `?key=<GUPSHUP_WEBHOOK_KEY>`.
 */
export async function POST(req: Request) {
  const expected = process.env.GUPSHUP_WEBHOOK_KEY ?? "";
  const key = req.headers.get("x-webhook-key") ?? new URL(req.url).searchParams.get("key") ?? "";
  if (!expected || !safeEqual(key, expected)) return new Response("forbidden", { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return new Response("ok"); // Gupshup also pings with empty bodies when validating the URL
  try {
    await applyWebhook(body);
  } catch (e) {
    console.error("[gupshup webhook]", e);
  }
  return new Response("ok"); // always 200 so Gupshup doesn't retry-storm
}

export async function GET() {
  return new Response("ok");
}
