"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui";

/** Renders every page of a PDF (from our own API) into canvases with pdf.js. */
export function PdfPreview({ url, width = 236 }: { url: string; width?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setState("loading");
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ url, withCredentials: true }).promise;
        if (cancelled) return;
        setPages(doc.numPages);
        const el = host.current!;
        el.innerHTML = "";
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width / base.width) * dpr });
          const wrap = document.createElement("div");
          wrap.className = "pdf-page up";
          wrap.style.width = `${width}px`;
          wrap.style.animationDelay = `${0.1 + n * 0.08}s`;
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          const tag = document.createElement("span");
          tag.className = "chip";
          tag.textContent = `Page ${n} of ${doc.numPages}`;
          Object.assign(tag.style, { position: "absolute", left: "10px", bottom: "10px", background: "#142844", color: "#fff" });
          wrap.append(canvas, tag);
          el.append(wrap);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
          if (n === 1) setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [url, width]);

  return (
    <div style={{ position: "relative" }}>
      {state === "loading" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "40px 24px", color: "#637383" }}>
          <Spinner /> Preparing preview…
        </div>
      )}
      {state === "error" && <div className="err" style={{ margin: "0 24px" }}>The preview could not be shown, but your document is saved. You can still continue.</div>}
      <div
        ref={host}
        aria-label={pages ? `${pages} page document preview` : "Document preview"}
        style={{ display: "flex", gap: 14, overflowX: "auto", padding: "8px 24px 16px", scrollSnapType: "x mandatory" }}
      />
    </div>
  );
}
