/**
 * WhatsApp intimation through Gupshup (approved template messages).
 * Template params are configured with GUPSHUP_TEMPLATE_PARAMS, "|"-separated, using placeholders:
 *   {exam} exam name · {name} signatory · {centre} centre code · {link} secure link · {token} link token
 * Example for "…complete your CSR Form for {{1}}." with button URL ".../s/{{1}}": GUPSHUP_TEMPLATE_PARAMS="{exam}|{token}"
 * The URL button's dynamic suffix is always the last param.
 */
type SendResult = { ok: true; messageId?: string } | { ok: false; error: string };

export function whatsappReady(): boolean {
  return !!(process.env.GUPSHUP_API_KEY && process.env.GUPSHUP_SOURCE && process.env.GUPSHUP_APP_NAME && process.env.GUPSHUP_TEMPLATE_ID);
}

export async function sendWhatsAppInvite(
  mobile: string,
  v: { exam: string; name: string; centre: string; link: string; token: string },
): Promise<SendResult> {
  if (!whatsappReady()) return { ok: false, error: "WhatsApp is not configured." };
  const spec = process.env.GUPSHUP_TEMPLATE_PARAMS || "{exam}";
  const values: Record<string, string> = { exam: v.exam, name: v.name, centre: v.centre, link: v.link, token: v.token };
  const params = spec.split("|").map((p) => p.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? ""));

  const body = new URLSearchParams({
    channel: "whatsapp",
    source: process.env.GUPSHUP_SOURCE!,
    destination: `${process.env.SMS_COUNTRY_CODE ?? "91"}${mobile}`,
    "src.name": process.env.GUPSHUP_APP_NAME!,
    template: JSON.stringify({ id: process.env.GUPSHUP_TEMPLATE_ID, params }),
  });
  try {
    const res = await fetch("https://api.gupshup.io/wa/api/v1/template/msg", {
      method: "POST",
      headers: { apikey: process.env.GUPSHUP_API_KEY!, "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body,
      cache: "no-store",
    });
    const text = await res.text();
    let data: { status?: string; messageId?: string; message?: string } = {};
    try { data = JSON.parse(text); } catch { /* non-JSON error */ }
    if (res.ok && data.status === "submitted") return { ok: true, messageId: data.messageId };
    return { ok: false, error: `Gupshup: ${data.message ?? text.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "WhatsApp request failed" };
  }
}
