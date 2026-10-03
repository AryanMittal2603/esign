"use client";

import { useEffect, useId, useRef, useState } from "react";

export type DropdownOption = { value: string; label: string; count?: number; dot?: string };

/** Themed single-select dropdown (replaces the browser's native <select>). Keyboard: ↑ ↓ Home End Enter Esc. */
export function Dropdown({ label, value, options, onChange, ariaLabel }: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
      requestAnimationFrame(() => list.current?.focus());
    }
  }, [open, options, value]);

  const choose = (v: string) => { onChange(v); setOpen(false); };
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(options[active].value); }
    else if (e.key === "Escape" || e.key === "Tab") { setOpen(false); }
  };

  return (
    <div ref={root} className="dd">
      <button
        type="button"
        className={`dd-btn${open ? " open" : ""}${value ? " set" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={ariaLabel ? `${ariaLabel}: ${current.label}` : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); } }}
      >
        <span className="dd-label">{label}</span>
        {current.dot && <span className="dd-dot" style={{ background: current.dot }} />}
        <span className="dd-value">{current.label}</span>
        {current.count !== undefined && <span className="dd-count">{current.count.toLocaleString("en-IN")}</span>}
        <svg className="dd-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          className="dd-list pop"
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel ?? label}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={o.value || "all"}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={selected}
                className={`dd-opt${i === active ? " active" : ""}${selected ? " selected" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
              >
                <span className="dd-dot" style={{ background: o.dot ?? "transparent", border: o.dot ? 0 : "1.5px solid #CBD5E1" }} />
                <span className="dd-opt-label">{o.label}</span>
                {o.count !== undefined && <span className="dd-count">{o.count.toLocaleString("en-IN")}</span>}
                <svg className="dd-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
