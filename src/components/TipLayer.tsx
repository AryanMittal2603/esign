"use client";

import { useEffect, useState } from "react";

/**
 * Themed tooltips for any element with a `data-tip` attribute (replaces the browser's title tooltips).
 * Rendered in a fixed layer so they are never clipped by overflow-hidden cells or cards.
 */
export function TipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);

  useEffect(() => {
    let current: Element | null = null;
    const show = (el: Element | null) => {
      const text = el?.getAttribute("data-tip");
      if (!el || !text) { current = null; setTip(null); return; }
      current = el;
      const r = el.getBoundingClientRect();
      const below = r.top < 56;
      setTip({ text, x: Math.min(window.innerWidth - 12, Math.max(12, r.left + r.width / 2)), y: below ? r.bottom + 8 : r.top - 8, below });
    };
    const over = (e: Event) => { const el = (e.target as Element)?.closest?.("[data-tip]"); if (el !== current) show(el); };
    const hide = () => { current = null; setTip(null); };
    document.addEventListener("pointerover", over);
    document.addEventListener("focusin", over);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("focusin", over);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  if (!tip) return null;
  return (
    <div role="tooltip" className="tip" style={{ left: tip.x, top: tip.y, transform: `translate(-50%, ${tip.below ? "0" : "-100%"})` }}>
      {tip.text}
    </div>
  );
}
