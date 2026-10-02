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
