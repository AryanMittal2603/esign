"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorBox, Icon, Kicker, Spinner, Words, api, useCountUp } from "@/components/ui";
import { useShell } from "@/components/admin/Shell";

type Stats = { total: number; sent: number; opened: number; uploaded: number; signed: number; pending: number };
type P = { id: string; name: string; examName: string | null; examDate: string | null; shift: string | null; stats: Stats };

export default function Overview() {
  const [projects, setProjects] = useState<P[] | null>(null);
  const [creating, setCreating] = useState(false);
  const k = useCountUp([projects === null]);

  useEffect(() => {
    const load = () => api<{ projects: P[] }>("/api/admin/projects").then((d) => setProjects(d.projects)).catch(() => setProjects([]));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const sum = (projects ?? []).reduce((a, p) => ({ total: a.total + p.stats.total, signed: a.signed + p.stats.signed, uploaded: a.uploaded + p.stats.uploaded, opened: a.opened + p.stats.opened }), { total: 0, signed: 0, uploaded: 0, opened: 0 });
  const kpis = [
    { label: "Projects", v: projects?.length ?? 0, fg: "#142844", note: "exam events" },
    { label: "Signatories", v: sum.total, fg: "#142844", note: "one per centre" },
    { label: "Opened", v: sum.opened, fg: "#2557DA", note: "opened their link" },
    { label: "Signed", v: sum.signed, fg: "#2E7567", note: `${sum.total ? Math.round((sum.signed / sum.total) * 100) : 0}% of all CSRs` },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Kicker delay={0.2}>Overview</Kicker>
          <h1 style={{ fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.04em" }}><Words text="Every exam, at a glance." start={0.3} accent={1} color="#B76A3B" /></h1>
        </div>
        <button className="btn btn-ink up" type="button" style={{ animationDelay: ".6s" }} onClick={() => setCreating(true)}><Icon name="plus" /> New project</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        {kpis.map((x, i) => (
          <div key={x.label} className="card up lift" style={{ animationDelay: `${0.4 + i * 0.07}s`, padding: "18px 18px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" }}>{x.label}</span>
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: x.fg }}>{Math.round(x.v * k)}</span>
            <span style={{ fontSize: 12.5, color: "#637383" }}>{x.note}</span>
          </div>
        ))}
      </div>

      {projects === null ? <Spinner /> : projects.length === 0 ? (
        <div className="card up" style={{ padding: 40, textAlign: "center", display: "grid", gap: 12, justifyItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Create your first project</div>
          <div style={{ color: "#637383" }}>A project is one exam event. Add its centres and signatories next.</div>
          <button className="btn btn-ink" type="button" onClick={() => setCreating(true)}><Icon name="plus" /> New project</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {projects.map((p, i) => {
            const pct = p.stats.total ? (p.stats.signed / p.stats.total) * 100 : 0;
            return (
              <Link key={p.id} href={`/admin/projects/${p.id}`} className="card lift up" style={{ animationDelay: `${0.7 + i * 0.08}s`, padding: 22, display: "flex", flexDirection: "column", gap: 16, textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{p.name}</div>
                    <div className="mono" style={{ fontSize: 12, color: "#637383", marginTop: 6 }}>{[p.examName, p.examDate, p.shift].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <Ring pct={pct * k} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                  {[["Centres", p.stats.total, "#142844"], ["Opened", p.stats.opened, "#2557DA"], ["Uploaded", p.stats.uploaded, "#7E5B12"], ["Signed", p.stats.signed, "#2E7567"]].map(([l, v, c]) => (
                    <div key={l as string}><div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#637383" }}>{l}</div><div style={{ fontSize: 20, fontWeight: 800, color: c as string, marginTop: 4 }}>{v}</div></div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {creating && <NewProject onClose={() => setCreating(false)} />}
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  return (
    <div style={{ position: "relative", width: 64, height: 64, flex: "none" }}>
      <svg width="64" height="64" viewBox="0 0 84 84" fill="none" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="42" cy="42" r="34" stroke="#E6ECEC" strokeWidth="10" />
        <circle cx="42" cy="42" r="34" stroke="#2E7567" strokeWidth="10" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct.toFixed(1)} 100`} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15 }}>{Math.round(pct)}%</span>
    </div>
  );
}

function NewProject({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { refreshProjects } = useShell();
  const [f, setF] = useState({ name: "", examName: "", examDate: "", shift: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await api<{ id: string }>("/api/admin/projects", { method: "POST", json: f });
      refreshProjects();
      router.push(`/admin/projects/${r.id}/import`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }} aria-label="New project">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Kicker delay={0}>New project</Kicker>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}><Icon name="close" size={16} stroke={2} /></button>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>One project per exam event</h2>
        <label><span className="label">Project name</span><input className="field" required autoFocus value={f.name} onChange={set("name")} placeholder="TGT Exam 2026 · Shift 1" /></label>
        <label><span className="label">Exam</span><input className="field" value={f.examName} onChange={set("examName")} placeholder="UPESSC TGT Exam 2026" /></label>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
          <label><span className="label">Exam date</span><input className="field" value={f.examDate} onChange={set("examDate")} placeholder="12 Oct 2026" /></label>
          <label><span className="label">Shift</span><input className="field" value={f.shift} onChange={set("shift")} placeholder="Shift 1" /></label>
        </div>
        <ErrorBox>{err}</ErrorBox>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-ink" type="submit" disabled={busy}>{busy ? <Spinner /> : null} Create &amp; add signatories</button>
        </div>
      </form>
    </div>
  );
}
