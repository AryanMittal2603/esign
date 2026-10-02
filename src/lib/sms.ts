/**
 * SMS through Authkey (https://api.authkey.io). SMS_MODE=console prints messages to the server log
 * instead, for local development without sending real texts.
 */
type SendResult = { ok: true } | { ok: false; error: string };

const API = "https://api.authkey.io/request";

async function callAuthkey(params: Record<string, string>): Promise<SendResult> {
  const qs = new URLSearchParams({
    authkey: process.env.AUTHKEY_API_KEY ?? "",
    country_code: process.env.SMS_COUNTRY_CODE ?? "91",
    ...params,
  });
  try {
    const res = await fetch(`${API}?${qs.toString()}`, { method: "GET", cache: "no-store" });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `Authkey HTTP ${res.status}: ${text.slice(0, 200)}` };
    // Authkey answers with JSON like {"Message":"Submitted Successfully", ...}; treat explicit errors as failures.
    if (/error|invalid|insufficient/i.test(text) && !/success/i.test(text)) return { ok: false, error: text.slice(0, 200) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SMS request failed" };
  }
}

export function smsMode(): "authkey" | "console" {
  return process.env.SMS_MODE === "authkey" ? "authkey" : "console";
}

export async function sendOtpSms(mobile: string, otp: string): Promise<SendResult> {
  if (smsMode() === "console") {
    console.log(`\n[sms:console] OTP for +91 ${mobile}: ${otp}\n`);
    return { ok: true };
  }
  return callAuthkey({ mobile, sid: process.env.AUTHKEY_OTP_SID ?? "", ...templateVars(process.env.AUTHKEY_OTP_VARS || "otp={otp}", { otp }) });
}

/**
 * Authkey fills each {#name#} in a DLT template from the URL parameter of the same name.
 * AUTHKEY_OTP_VARS maps your template's variable names to values, e.g. "otp={otp}&company=SeqreSign".
 * Placeholders: {otp}, {site} (APP_URL host), {minutes} (OTP validity).
 */
export function templateVars(spec: string, values: Record<string, string>): Record<string, string> {
  const all: Record<string, string> = {
    site: new URL(process.env.APP_URL ?? "http://localhost:3000").host,
    minutes: String(otpTtlMinutes()),
    ...values,
  };
  const out: Record<string, string> = {};
  for (const pair of spec.split("&")) {
    const [k, ...rest] = pair.split("=");
    if (!k?.trim()) continue;
    out[k.trim()] = rest.join("=").replace(/\{(\w+)\}/g, (_, key) => all[key] ?? "");
  }
  return out;
}

export function otpTtlMinutes(): number {
  const n = Number(process.env.OTP_TTL_MINUTES);
  return Number.isFinite(n) && n >= 1 && n <= 30 ? n : 10;
}

export function linkSmsAvailable(): boolean {
  return smsMode() === "console" || !!process.env.AUTHKEY_LINK_SID;
}

export async function sendLinkSms(mobile: string, name: string, link: string): Promise<SendResult> {
  if (smsMode() === "console") {
    console.log(`\n[sms:console] Signing link for ${name} (+91 ${mobile}): ${link}\n`);
    return { ok: true };
  }
  if (!process.env.AUTHKEY_LINK_SID) {
    return { ok: false, error: "No SMS template for signing links yet. Set AUTHKEY_LINK_SID, or send by WhatsApp / copy link." };
  }
  return callAuthkey({ mobile, sid: process.env.AUTHKEY_LINK_SID, ...templateVars(process.env.AUTHKEY_LINK_VARS || "name={name}&link={link}", { name, link }) });
}

export function signingLink(token: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/s/${token}`;
}

export function linkMessage(name: string, link: string): string {
  return `Dear ${name}, please upload and eSign your centre's CSR using this secure link: ${link}`;
}
