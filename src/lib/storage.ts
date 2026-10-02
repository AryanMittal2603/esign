import fs from "node:fs/promises";
import path from "node:path";
import { decrypt, encrypt } from "./crypto";

/**
 * Encrypted file storage. Local disk for now; keep this interface when moving to S3
 * (put/get/remove by key) so nothing else in the app has to change.
 */
const root = path.resolve(process.env.STORAGE_DIR ?? "./storage");

function resolveKey(key: string): string {
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function putFile(key: string, data: Buffer): Promise<void> {
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, encrypt(data));
}

export async function getFile(key: string): Promise<Buffer> {
  return decrypt(await fs.readFile(resolveKey(key)));
}

export async function removeFile(key: string): Promise<void> {
  await fs.rm(resolveKey(key), { force: true });
}
