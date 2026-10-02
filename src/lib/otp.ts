import type { OtpPurpose } from "@prisma/client";
import { db } from "./db";
import { hashOtp, randomOtp, randomRef, safeEqual } from "./crypto";
import { sendOtpSms } from "./sms";

const TTL_MS = 5 * 60 * 1000;
const RESEND_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

export type IssueResult =
  | { ok: true; ref: string; sentAt: Date; resendIn: number }
  | { ok: false; error: string; status: number; resendIn?: number };

export async function issueOtp(mobile: string, purpose: OtpPurpose, signatoryId?: string): Promise<IssueResult> {
  const last = await db.otp.findFirst({
    where: { mobile, purpose, signatoryId: signatoryId ?? null },
    orderBy: { createdAt: "desc" },
  });
  if (last && Date.now() - last.createdAt.getTime() < RESEND_MS) {
    const resendIn = Math.ceil((RESEND_MS - (Date.now() - last.createdAt.getTime())) / 1000);
    return { ok: false, error: `Please wait ${resendIn}s before asking for a new code.`, status: 429, resendIn };
  }
  const code = randomOtp();
  const ref = randomRef();
  const sent = await sendOtpSms(mobile, code);
  if (!sent.ok) return { ok: false, error: `Could not send the SMS. ${sent.error}`, status: 502 };
  const row = await db.otp.create({
    data: { mobile, purpose, signatoryId: signatoryId ?? null, ref, codeHash: hashOtp(code, ref), expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return { ok: true, ref, sentAt: row.createdAt, resendIn: RESEND_MS / 1000 };
}

export type VerifyResult = { ok: true; ref: string; sentAt: Date } | { ok: false; error: string };

export async function verifyOtp(mobile: string, purpose: OtpPurpose, code: string, signatoryId?: string): Promise<VerifyResult> {
  const otp = await db.otp.findFirst({
    where: { mobile, purpose, signatoryId: signatoryId ?? null, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return { ok: false, error: "Ask for a code first." };
  if (otp.expiresAt < new Date()) return { ok: false, error: "This code has expired. Ask for a new one." };
  if (otp.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many wrong attempts. Ask for a new code." };
  const good = /^\d{6}$/.test(code) && safeEqual(hashOtp(code, otp.ref), otp.codeHash);
  if (!good) {
    await db.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_ATTEMPTS - otp.attempts - 1;
    return { ok: false, error: left > 0 ? `That code is not right. ${left} tries left.` : "Too many wrong attempts. Ask for a new code." };
  }
  await db.otp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return { ok: true, ref: otp.ref, sentAt: otp.createdAt };
}
