"use client";

import { useEffect, useRef } from "react";

const INK = "#295CA8";
const LINE = "rgba(140,179,219,0.55)";

/** Facial impression (dot portrait from the live photo), drawn from the compact "20x26:hex…" grid stored per signatory. */
export function Impression({ grid, width = 40, height = 52 }: { grid: string; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    const m = /^(\d+)x(\d+):([0-9a-f]+)$/.exec(grid);
    if (!c || !m) return;
    const cols = +m[1], rows = +m[2], cells = m[3];
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, width, height);

    // guilloche backdrop
    g.strokeStyle = LINE;
    g.lineWidth = 0.5;
    for (let k = 0; k < 6; k++) {
      const phase = (k / 6) * Math.PI * 2;
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const y = height / 2 + height * 0.3 * Math.sin(t * Math.PI * 4 + phase) * Math.cos(t * Math.PI * 1.5 + phase / 2);
        if (i) g.lineTo(t * width, y); else g.moveTo(0, y);
      }
      g.stroke();
    }

    // halftone dots
    const cw = width / cols, ch = height / rows;
    const maxR = Math.min(cw, ch) * 0.56;
    g.fillStyle = INK;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const d = parseInt(cells[r * cols + col] ?? "0", 16) / 15;
        if (d < 0.06) continue;
        g.beginPath();
        g.arc((col + 0.5 + (r % 2 ? 0.25 : -0.25)) * cw, (r + 0.5) * ch, maxR * Math.sqrt(d), 0, Math.PI * 2);
        g.fill();
      }
    }
  }, [grid, width, height]);

  return <canvas ref={ref} style={{ width, height, display: "block", borderRadius: 6, background: "#F3F8FD", boxShadow: "inset 0 0 0 1px #DCE7F3" }} aria-hidden="true" />;
}
