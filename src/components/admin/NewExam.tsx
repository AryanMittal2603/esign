"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBox, Icon, Kicker, Spinner, api } from "@/components/ui";

export function NewExam({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", examName: "", examDate: "", shift: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await api<{ id: string }>("/api/admin/projects", { method: "POST", json: f });
      router.push(`/admin/exams/${r.id}/import`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }} aria-label="New exam">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Kicker delay={0}>New exam</Kicker>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}><Icon name="close" size={16} stroke={2} /></button>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>One exam, one shift</h2>
        <label><span className="label">Exam *</span><input className="field" required autoFocus value={f.examName} onChange={set("examName")} placeholder="UPESSC TGT Exam 2026" /></label>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
          <label><span className="label">Exam date *</span><input className="field" type="date" required value={f.examDate} onChange={set("examDate")} /></label>
          <label><span className="label">Shift *</span><input className="field" required value={f.shift} onChange={set("shift")} placeholder="Shift 1" list="shift-options" /></label>
          <datalist id="shift-options"><option value="Shift 1" /><option value="Shift 2" /><option value="Shift 3" /></datalist>
        </div>
        <label>
          <span className="label">Display name <span style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></span>
          <input className="field" value={f.name} onChange={set("name")} placeholder={f.examName && f.shift ? `${f.examName} · ${f.shift}` : "Defaults to Exam · Shift"} />
        </label>
        <p style={{ margin: 0, fontSize: 13, color: "#637383" }}>Exam, date and shift together must be unique.</p>
        <ErrorBox>{err}</ErrorBox>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-ink" type="submit" disabled={busy}>{busy ? <Spinner /> : null} Create &amp; add signatories</button>
        </div>
      </form>
    </div>
  );
}
