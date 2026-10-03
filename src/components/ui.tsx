"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { STATUS_META, type Status } from "@/lib/format";

/* ── brand ── */
export function Brand({ size = 18, light = false, animate = true }: { size?: number; light?: boolean; animate?: boolean }) {
  const ink = light ? "#FFFFFF" : "#142844";
  const accent = light ? "#E0A27A" : "#B76A3B";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.45 }}>
      <svg width={size * 1.4} height={size * 1.4} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="13" stroke={ink} strokeWidth="2.2" pathLength={1} className={animate ? "draw" : undefined} />
        <path d="M10 16.8l4.2 4.2 7.8-9" stroke={accent} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className={animate ? "draw" : undefined} style={{ animationDelay: ".6s" }} />
      </svg>
      <span style={{ fontSize: size, fontWeight: 800, letterSpacing: "-0.02em", color: ink }}>
        Seqre<span style={{ color: accent }}>Sign</span>
      </span>
    </span>
  );
}

/** Headline that arrives word by word (blur + lift). The last `accent` words take the accent colour. */
export function Words({ text, start = 0.4, step = 0.07, accent = 0, color = "#2E7567" }: { text: string; start?: number; step?: number; accent?: number; color?: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="w" style={{ animationDelay: `${(start + i * step).toFixed(2)}s`, color: i >= words.length - accent ? color : undefined }}>{w}</span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

export function Kicker({ children, delay = 0.3, style }: { children: ReactNode; delay?: number; style?: CSSProperties }) {
  return <div className="kicker" style={{ animationDelay: `${delay}s`, ...style }}>{children}</div>;
}

export function Chip({ status, style }: { status: Status; style?: CSSProperties }) {
  const m = STATUS_META[status];
  return <span className="chip" style={{ background: m.bg, color: m.fg, ...style }}>{m.label}</span>;
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="err up" role="alert">
      <Icon name="alert" size={16} />
      <span>{children}</span>
    </div>
  );
}

/* ── icons (inline stroke) ── */
const PATHS: Record<string, ReactNode> = {
  back: <path d="M15 6l-6 6 6 6" />,
  next: <path d="M9 6l6 6-6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" /></>,
  download: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 20h16" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></>,
  pen: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  sms: <path d="M4 5h16v11H9l-5 4z" />,
  whatsapp: <><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" /><path d="M9 10c.5 2 2 3.5 5 4.5l1-1.5" /></>,
  send: <><path d="M21 4L3 11l7 2 2 7z" /><path d="M10 13l4-4" /></>,
  sheet: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8l8 8M16 8l-8 8" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  grid: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  shield: <><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  logout: <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M15.5 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2" /></>,
  refresh: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
};

export function Icon({ name, size = 18, stroke = 1.8, color = "currentColor", style }: { name: keyof typeof PATHS | string; size?: number; stroke?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", ...style }}>
      {PATHS[name]}
    </svg>
  );
}

/* ── seal used on success screens ── */
export function Seal({ size = 124 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 124 124" fill="none" aria-hidden="true">
      <circle cx="62" cy="62" r="58" stroke="#2E7567" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="3 6" className="spin-slow" />
      <circle cx="62" cy="62" r="48" stroke="#2E7567" strokeWidth="3" pathLength={1} className="draw" style={{ animationDelay: ".5s" }} />
      <circle cx="62" cy="62" r="40" fill="#2E7567" className="pop" style={{ animationDelay: "1.3s", transformBox: "fill-box", transformOrigin: "center" }} />
      <path d="M45 63l12 12 22-25" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="draw" style={{ animationDelay: "1.55s" }} />
    </svg>
  );
}

/* ── OTP boxes over one real input ── */
export function OtpInput({ value, onChange, autoFocus, label = "6-digit code" }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; label?: string }) {
  return (
    <div style={{ position: "relative", display: "flex", gap: 8 }}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const on = i === value.length;
        return (
          <div key={i} className="otp" style={{ borderColor: on ? "#142844" : value[i] ? "#A8BBC2" : "#D4DEE0", boxShadow: on ? "0 0 0 4px #DCECF2" : "none", flex: "1 1 0", width: "auto", maxWidth: 52 }}>
            {value[i] ?? ""}
            {on && <span className="blink" style={{ width: 2, height: 26, background: "#142844" }} />}
          </div>
        );
      })}
      <input
        className="otp-input"
        inputMode="none"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-label={label}
      />
    </div>
  );
}

/* ── tiny toast ── */
export function useToast() {
  const [t, setT] = useState<{ msg: string; bad?: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((msg: string, bad = false) => {
    setT({ msg, bad });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), 3200);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const node = t ? (
    <div className={`toast${t.bad ? " bad" : ""}`} role="status" key={t.msg}>
      <Icon name={t.bad ? "alert" : "check"} color={t.bad ? "#FFD2CC" : "#5FD0B0"} stroke={2.4} />
      {t.msg}
    </div>
  ) : null;
  return [node, say] as const;
}

/* ── count-up for KPIs ── */
export function useCountUp(deps: unknown[] = [], duration = 1400) {
  const [k, setK] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setK(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return k;
}

export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Request failed (${res.status})`), { status: res.status, data });
  return data as T;
}

export function Silhouette({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" aria-hidden="true">
      <circle cx="19" cy="15" r="7" fill="#8FB3CF" />
      <path d="M5 38c1-9 7-13 14-13s13 4 14 13z" fill="#8FB3CF" />
    </svg>
  );
}

/* ── on-screen number keypad (replaces the phone's own keyboard) ── */
export function Keypad({ value, onChange, max, disabled }: { value: string; onChange: (v: string) => void; max: number; disabled?: boolean }) {
  const press = (next: string) => {
    if (disabled) return;
    try { navigator.vibrate?.(8); } catch { /* not supported */ }
    onChange(next);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];
  return (
    <div className="keypad up" role="group" aria-label="Number keypad" style={{ animationDelay: ".9s" }}>
      {keys.map((k) => {
        if (k === "clear") {
          return <button key={k} type="button" className="key key-soft" onClick={() => press("")} disabled={disabled || !value} aria-label="Clear">Clear</button>;
        }
        if (k === "back") {
          return (
            <button key={k} type="button" className="key key-soft" onClick={() => press(value.slice(0, -1))} disabled={disabled || !value} aria-label="Delete last digit">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5h11v14H9l-6-7z" /><path d="M12.5 9.5l5 5M17.5 9.5l-5 5" /></svg>
            </button>
          );
        }
        return <button key={k} type="button" className="key" onClick={() => value.length < max && press(value + k)} disabled={disabled}>{k}</button>;
      })}
    </div>
  );
}
