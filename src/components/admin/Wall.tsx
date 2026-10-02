"use client";

import { useEffect, useRef, useState } from "react";

/** One character per signatory: S signed · U uploaded · O opened · L link sent · N not sent. */
export const WALL_COLORS: Record<string, string> = { S: "#2E7567", U: "#C9962B", O: "#2557DA", L: "#A8BBC2", N: "#D4DEE0" };
export const WALL_LABELS: Record<string, string> = { S: "Signed", U: "Uploaded", O: "Opened", L: "Link sent", N: "Not sent" };

const DOM_LIMIT = 1500;

/**
 * Small exams render animated tiles; large ones draw onto a single canvas so 10,000+ signatories
 * stay smooth. Clicking a tile reports its index (centre-code order).
 */
export function Wall({ codes, focus, onPick }: { codes: string; focus: string | null; onPick: (index: number) => void }) {
  if (codes.length <= DOM_LIMIT) {
    const n = codes.length;
    const size = n <= 60 ? 30 : n <= 240 ? 20 : 13;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * 2)));
    return (
      <div className="wall" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))`, gap: n <= 60 ? 6 : 3 }}>
        {Array.from(codes).map((c, i) => {
          const d = Math.min(2, 0.6 + ((i % cols) + Math.floor(i / cols) * 0.7) * 0.02);
          return (
            <button key={i} type="button" className="tile" title={`#${i + 1} · ${WALL_LABELS[c]}`} aria-label={`Signatory ${i + 1}, ${WALL_LABELS[c]}`} onClick={() => onPick(i)}
              style={{ background: WALL_COLORS[c], opacity: !focus || focus === c ? 1 : 0.16, animationDelay: `${d.toFixed(3)}s`, border: 0, padding: 0, cursor: "pointer", maxWidth: 44 }} />
          );
        })}
      </div>
    );
  }
  return <CanvasWall codes={codes} focus={focus} onPick={onPick} />;
}

function CanvasWall({ codes, focus, onPick }: { codes: string; focus: string | null; onPick: (index: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const cell = codes.length > 5000 ? 6 : 8;
  const step = cell + 1;
  const cols = Math.max(1, Math.floor((width + 1) / step));
  const rows = Math.ceil(codes.length / cols);

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = cols * step * dpr;
    c.height = rows * step * dpr;
    c.style.width = `${cols * step}px`;
    c.style.height = `${rows * step}px`;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cols * step, rows * step);
    for (let i = 0; i < codes.length; i++) {
      const ch = codes[i];
      ctx.globalAlpha = !focus || focus === ch ? 1 : 0.15;
      ctx.fillStyle = WALL_COLORS[ch];
      ctx.fillRect((i % cols) * step, Math.floor(i / cols) * step, cell, cell);
    }
    if (hover !== null && hover < codes.length) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#142844";
      ctx.lineWidth = 1.5;
      ctx.strokeRect((hover % cols) * step - 0.5, Math.floor(hover / cols) * step - 0.5, cell + 1, cell + 1);
    }
  }, [codes, focus, width, cols, rows, step, cell, hover]);

  const indexAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientY - r.top) / step) * cols + Math.floor((e.clientX - r.left) / step);
    return i >= 0 && i < codes.length ? i : null;
  };

  return (
    <div ref={box} className="fade" style={{ animationDelay: ".6s", maxHeight: 340, overflowY: "auto", overflowX: "hidden" }}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Signatory wall with ${codes.length.toLocaleString("en-IN")} tiles`}
        title={hover !== null ? `#${hover + 1} · ${WALL_LABELS[codes[hover]]} · click to open` : undefined}
        onMouseMove={(e) => setHover(indexAt(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => { const i = indexAt(e); if (i !== null) onPick(i); }}
        style={{ display: "block", cursor: "pointer" }}
      />
    </div>
  );
}
