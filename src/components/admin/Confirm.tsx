"use client";

import { useEffect } from "react";
import { Icon, Spinner } from "@/components/ui";

/** Themed confirmation dialog (replaces window.confirm). */
export function Confirm({ title, body, confirmLabel, danger, busy, onConfirm, onCancel }: {
  title: string; body: React.ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);
  return (
    <div className="modal-back" style={{ zIndex: 120 }} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-label={title} style={{ width: "min(420px, 100%)", display: "flex", flexDirection: "column", gap: 14 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", background: danger ? "#FEECEB" : "#EAF1FF" }}>
          <Icon name={danger ? "trash" : "info"} size={20} color={danger ? "#B42318" : "#1D4ED8"} />
        </span>
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</h2>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: "#475569" }}>{body}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
          <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={busy} autoFocus>Cancel</button>
          <button className="btn" type="button" onClick={onConfirm} disabled={busy} style={{ background: danger ? "#B42318" : "#142844", color: "#fff" }}>{busy ? <Spinner /> : null} {confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
