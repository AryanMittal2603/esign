import crypto from "node:crypto";

export function sha256(data: Buffer | Uint8Array | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/** URL-safe random token for secure links (192 bits). */
export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function randomOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Short human-readable reference like 7F3A-2C91. */
export function randomRef(): string {
  const h = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4)}`;
}

function storageKey(): Buffer {
  const hex = process.env.STORAGE_KEY ?? "";
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) throw new Error("STORAGE_KEY must be 32 bytes of hex (64 characters)");
  return key;
}

/** AES-256-GCM. Layout: [12-byte IV][16-byte tag][ciphertext]. */
export function encrypt(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", storageKey(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decrypt(blob: Buffer): Buffer {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", storageKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]);
}

export function hashOtp(code: string, salt: string): string {
  return crypto.createHmac("sha256", process.env.JWT_SECRET ?? "").update(`${salt}:${code}`).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
