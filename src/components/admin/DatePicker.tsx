"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export const prettyDate = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? `${m[3]} ${MONTHS[+m[2] - 1].slice(0, 3)} ${m[1]}` : "";
};

/** Themed date picker (replaces the browser's native date input). Value is "YYYY-MM-DD". */
export function DatePicker({ value, onChange, placeholder = "Pick a date", id }: { value: string; onChange: (v: string) => void; placeholder?: string; id?: string }) {
  const today = new Date();
  const init = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : today;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ y: init.getFullYear(), m: init.getMonth() });
  const [focus, setFocus] = useState(value || iso(today.getFullYear(), today.getMonth(), today.getDate()));
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // fixed position so the calendar is never clipped by a scrolling dialog; flips up when space below is short
  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const h = 372, w = 292;
    const below = window.innerHeight - r.bottom;
    const top = below >= h + 12 || r.top < h + 12 ? r.bottom + 6 : r.top - h - 6;
    setPos({ left: Math.min(Math.max(8, r.left), window.innerWidth - w - 8), top: Math.max(8, top) });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    const onDoc = (e: MouseEvent) => { const t = e.target as Node; if (!root.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>("button[data-focus='1']")?.focus({ preventScroll: true }));
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const first = new Date(view.y, view.m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const daysIn = new Date(view.y, view.m + 1, 0).getDate();
  const cells = Array.from({ length: offset + daysIn }, (_, i) => (i < offset ? null : i - offset + 1));
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());
  const shift = (delta: number) => setView((v) => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  const moveFocus = (days: number) => {
    const d = new Date(`${focus}T00:00:00`);
    d.setDate(d.getDate() + days);
    const next = iso(d.getFullYear(), d.getMonth(), d.getDate());
    setFocus(next);
    setView({ y: d.getFullYear(), m: d.getMonth() });
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`button[data-iso='${next}']`)?.focus({ preventScroll: true }));
  };
  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in map) { e.preventDefault(); moveFocus(map[e.key]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={root} className="dd" style={{ width: "100%" }}>
      <button ref={btn} id={id} type="button" className={`field dp-btn${open ? " open" : ""}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span style={{ color: value ? "#0F172A" : "#8C99A6" }}>{value ? prettyDate(value) : placeholder}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div ref={popRef} className="dp-pop pop" role="dialog" aria-label="Choose date" onKeyDown={onKey} style={pos ? { position: "fixed", left: pos.left, top: pos.top } : { visibility: "hidden" }}>
          <div className="dp-head">
            <button type="button" className="icon-btn icon-btn-ghost" aria-label="Previous month" onClick={() => shift(-1)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
            <span style={{ fontWeight: 800, fontSize: 14.5 }}>{MONTHS[view.m]} {view.y}</span>
            <button type="button" className="icon-btn icon-btn-ghost" aria-label="Next month" onClick={() => shift(1)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>
          </div>
          <div className="dp-grid" ref={grid}>
            {DAYS.map((d) => <span key={d} className="dp-dow">{d}</span>)}
            {cells.map((d, i) => {
              if (d === null) return <span key={`e${i}`} />;
              const v = iso(view.y, view.m, d);
              const sel = v === value;
              return (
                <button key={v} type="button" data-iso={v} data-focus={v === focus ? "1" : undefined} tabIndex={v === focus ? 0 : -1}
                  className={`dp-day${sel ? " sel" : ""}${v === todayIso ? " today" : ""}`} aria-pressed={sel} aria-label={prettyDate(v)}
                  onClick={() => { onChange(v); setFocus(v); setOpen(false); }}>{d}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #EEF2F6", marginTop: 6 }}>
            <button type="button" className="link" style={{ fontSize: 13 }} onClick={() => { onChange(todayIso); setOpen(false); }}>Today</button>
            {value && <button type="button" className="link" style={{ fontSize: 13, color: "#64748B" }} onClick={() => { onChange(""); setOpen(false); }}>Clear</button>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
