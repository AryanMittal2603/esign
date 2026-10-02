import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function clientInfo(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  let ip = (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "").trim() || "local";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip === "::1") ip = "127.0.0.1";
  const userAgent = req.headers.get("user-agent") ?? "";
  return { ip, userAgent };
}

export function describeDevice(ua: string): string {
  const os = /Android ([\d.]+)/.exec(ua)?.[0] ?? (/iPhone OS ([\d_]+)/.exec(ua) ? `iOS ${/iPhone OS ([\d_]+)/.exec(ua)![1].replace(/_/g, ".")}` : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Unknown OS");
  const browser = /Edg\/(\d+)/.exec(ua) ? `Edge ${/Edg\/(\d+)/.exec(ua)![1]}` : /Chrome\/(\d+)/.exec(ua) ? `Chrome ${/Chrome\/(\d+)/.exec(ua)![1]}` : /Version\/(\d+).*Safari/.exec(ua) ? `Safari ${/Version\/(\d+)/.exec(ua)![1]}` : /Firefox\/(\d+)/.exec(ua) ? `Firefox ${/Firefox\/(\d+)/.exec(ua)![1]}` : "Browser";
  return `${os} · ${browser}`;
}

export const MOBILE_RE = /^[6-9]\d{9}$/;

export function normaliseMobile(input: unknown): string {
  let m = String(input ?? "").replace(/\D/g, "");
  if (m.length === 12 && m.startsWith("91")) m = m.slice(2);
  if (m.length === 11 && m.startsWith("0")) m = m.slice(1);
  return m;
}
