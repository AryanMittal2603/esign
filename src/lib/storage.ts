import fs from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import { decrypt, encrypt } from "./crypto";

/**
 * Encrypted file storage.
 * - "blob": private Vercel Blob (used when BLOB_READ_WRITE_TOKEN is set, e.g. on Vercel)
 * - "local": files on disk under STORAGE_DIR (local development)
 * Everything is AES-256-GCM encrypted before it is written, whichever driver is used.
 */
export function storageDriver(): "blob" | "local" {
  if (process.env.STORAGE_DRIVER === "local") return "local";
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local";
}

const root = path.resolve(process.env.STORAGE_DIR ?? "./storage");

function resolveKey(key: string): string {
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

async function blobBytes(pathname: string): Promise<Buffer> {
  const r = await get(pathname, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) throw new Error(`File not found in storage: ${pathname}`);
  return Buffer.from(await new Response(r.stream).arrayBuffer());
}

export async function putFile(key: string, data: Buffer): Promise<void> {
  const sealed = encrypt(data);
  if (storageDriver() === "blob") {
    await put(key, sealed, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/octet-stream" });
    return;
  }
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, sealed);
}

export async function getFile(key: string): Promise<Buffer> {
  if (storageDriver() === "blob") return decrypt(await blobBytes(key));
  return decrypt(await fs.readFile(resolveKey(key)));
}

export async function removeFile(key: string): Promise<void> {
  if (storageDriver() === "blob") {
    await del(key).catch(() => {});
    return;
  }
  await fs.rm(resolveKey(key), { force: true });
}

/* ── raw uploads sent straight from the browser to Blob (not yet encrypted) ── */

export function incomingPrefix(signatoryId: string): string {
  return `incoming/${signatoryId}/`;
}

/** Reads a browser-uploaded part, then deletes it so no unencrypted copy remains. */
export async function takeIncoming(pathname: string): Promise<Buffer> {
  const bytes = await blobBytes(pathname);
  await del(pathname).catch(() => {});
  return bytes;
}

/** Permanently deletes every stored file under a folder prefix (e.g. "projects/<id>/"). Returns how many were removed. */
export async function removePrefix(prefix: string): Promise<number> {
  if (!prefix.endsWith("/") || prefix.includes("..")) throw new Error("Invalid prefix");
  if (storageDriver() === "blob") {
    let removed = 0;
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      if (page.blobs.length) {
        await del(page.blobs.map((b) => b.url));
        removed += page.blobs.length;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return removed;
  }
  const dir = resolveKey(prefix.replace(/\/$/, ""));
  const count = await fs.readdir(dir, { recursive: true, withFileTypes: true }).then((f) => f.filter((e) => e.isFile()).length).catch(() => 0);
  await fs.rm(dir, { recursive: true, force: true });
  return count;
}
