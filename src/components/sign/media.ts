"use client";

/** Re-encode any camera/gallery image to a JPEG no larger than `max` px on its long edge. Handles HEIC on Safari. */
export async function toJpeg(file: Blob, max = 2200, quality = 0.88): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("This image could not be read. Try a JPG or PNG."));
      el.src = url;
    });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** POST multipart with upload progress (fetch has no upload progress). */
export function uploadWithProgress(url: string, form: FormData, onProgress: (p: number) => void): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* keep empty */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error((data.error as string) ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network problem while uploading. Check your connection and try again."));
    xhr.send(form);
  });
}

/** Uploads each part directly to private Vercel Blob, returning the pathnames for the server to merge. */
export async function uploadToBlob(
  token: string,
  prefix: string,
  parts: { blob: Blob; type: string; name: string }[],
  onProgress: (p: number) => void,
): Promise<{ pathname: string; type: string; name: string }[]> {
  const { upload } = await import("@vercel/blob/client");
  const total = parts.reduce((a, p) => a + p.blob.size, 0) || 1;
  const done: number[] = parts.map(() => 0);
  const out: { pathname: string; type: string; name: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const safe = p.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-60) || `part-${i + 1}`;
    try {
      const r = await upload(`${prefix}${String(i + 1).padStart(3, "0")}-${safe}`, p.blob, {
        access: "private",
        handleUploadUrl: `/api/sign/${token}/blob-upload`,
        contentType: p.type,
        multipart: p.blob.size > 8 * 1024 * 1024,
        onUploadProgress: (e) => {
          done[i] = e.loaded;
          onProgress(Math.min(0.99, done.reduce((a, b) => a + b, 0) / total));
        },
      });
      out.push({ pathname: r.pathname, type: p.type, name: p.name });
    } catch (e) {
      throw new Error((e as Error).message?.replace(/^Vercel Blob: /, "") || "Upload failed. Check your connection and try again.");
    }
  }
  onProgress(1);
  return out;
}
