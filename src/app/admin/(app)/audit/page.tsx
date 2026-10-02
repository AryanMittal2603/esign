"use client";

import { useCallback, useEffect, useState } from "react";
import { Kicker, Spinner, Words, api } from "@/components/ui";
import { fmtIST } from "@/lib/format";

type Log = { id: string; at: string; actor: string; action: string; text: string; project: string | null; signatory: string | null; ip: string | null };

const ACTOR = { ADMIN: { bg: "#DCECF2", fg: "#142844" }, SIGNATORY: { bg: "#E3F0EC", fg: "#2E7567" }, SYSTEM: { bg: "#F7EDD5", fg: "#7E5B12" } } as Record<string, { bg: string; fg: string }>;

export default function AuditPage() {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (before?: string) => {
    setBusy(true);
    const qs = new URLSearchParams({ limit: "100", ...(projectId ? { projectId } : {}), ...(before ? { before } : {}) });
    const d = await api<{ logs: Log[]; projects: { id: string; name: string }[] }>(`/api/admin/audit?${qs}`);
    setProjects(d.projects);
    setLogs((prev) => (before && prev ? [...prev, ...d.logs] : d.logs));
    setMore(d.logs.length === 100);
    setBusy(false);
  }, [projectId]);
  useEffect(() => { setLogs(null); load(); }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Kicker delay={0.2}>Audit trail</Kicker>
          <h1 style={{ fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.04em" }}><Words text="Every action, on the record." start={0.3} accent={2} /></h1>
        </div>
        <label className="up" style={{ animationDelay: ".6s", minWidth: 260 }}>
          <span className="label">Project</span>
          <select className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ height: 44 }}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>

      <section className="card up" style={{ animationDelay: ".7s", padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 980 }}>
            <div className="grid-row th" style={{ gridTemplateColumns: COLS }}><span>Time (IST)</span><span>Actor</span><span>What happened</span><span>Signatory</span><span>Project</span><span>IP</span></div>
            {logs === null ? <div style={{ padding: 30 }}><Spinner /></div> : logs.map((l, i) => (
              <div key={l.id} className="grid-row tr up" style={{ gridTemplateColumns: COLS, animationDelay: `${Math.min(1.2, 0.75 + i * 0.02)}s` }}>
                <span className="mono" style={{ fontSize: 12.5 }}>{fmtIST(l.at)}</span>
                <span><span className="chip" style={{ background: ACTOR[l.actor]?.bg, color: ACTOR[l.actor]?.fg }}>{l.actor.toLowerCase()}</span></span>
                <span style={{ fontWeight: 600 }}>{l.text}</span>
                <span className="ellipsis" style={{ color: "#3E5266" }}>{l.signatory ?? "—"}</span>
                <span className="ellipsis" style={{ color: "#637383" }}>{l.project ?? "—"}</span>
                <span className="mono" style={{ fontSize: 12, color: "#637383" }}>{l.ip ?? ""}</span>
              </div>
            ))}
            {logs?.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#637383" }}>Nothing recorded yet.</div>}
          </div>
        </div>
        {more && logs && logs.length > 0 && (
          <div style={{ padding: 16, display: "grid", placeItems: "center", borderTop: "1px solid #E6ECEC" }}>
            <button className="btn btn-line btn-sm" type="button" disabled={busy} onClick={() => load(logs[logs.length - 1].at)}>{busy ? <Spinner /> : null} Load older</button>
          </div>
        )}
      </section>
    </div>
  );
}

const COLS = "190px 110px minmax(240px, 2fr) minmax(180px, 1.2fr) minmax(160px, 1fr) 120px";
