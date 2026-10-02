"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Chip, ErrorBox, Icon, Kicker, Spinner, Words, api, useCountUp, useToast } from "@/components/ui";
import { STATUS_META, fmtGeo, fmtIST, fmtTimeIST, type Status } from "@/lib/format";
import { SignatoryDrawer } from "@/components/admin/SignatoryDrawer";

type S = {
  id: string; name: string; mobile: string; centreCode: string; centreName: string; status: Status; link: string;
  linkSentAt: string | null; linkSentVia: string | null; openedAt: string | null; uploadedAt: string | null; pages: number | null;
  signedAt: string | null; documentId: string | null; geoLat: number | null; geoLng: number | null; hasPhoto: boolean;
};
type Data = {
  project: { id: string; name: string; examName: string | null; examDate: string | null; shift: string | null };
  stats: { total: number; sent: number; opened: number; uploaded: number; signed: number; pending: number; byStatus: Record<Status, number> };
  recent: { id: string; name: string; centreCode: string; centreName: string; signedAt: string }[];
  lastHour: number;
  sms: { mode: string; linkSms: boolean };
  signatories: S[];
};

const GROUPS: { key: string; label: string; match: Status[] }[] = [
  { key: "signed", label: "Signed", match: ["SIGNED"] },
  { key: "uploaded", label: "Uploaded", match: ["UPLOADED"] },
  { key: "opened", label: "Opened", match: ["OPENED", "VERIFIED"] },
  { key: "sent", label: "Link sent", match: ["SENT"] },
  { key: "imported", label: "Not sent", match: ["IMPORTED"] },
];
const PAGE = 50;

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "signed" | "pending" | "unsent">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [sending, setSending] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [toast, say] = useToast();
  const k = useCountUp([data === null]);

  const load = useCallback(async () => {
    try { const d = await api<Data>(`/api/admin/projects/${id}`); setData(d); setUpdated(new Date()); setErr(""); }
    catch (e) { setErr((e as Error).message); }
  }, [id]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const wall = useMemo(() => {
    if (!data) return [];
    const cols = Math.max(1, Math.ceil(Math.sqrt(data.signatories.length * 2)));
    return data.signatories.map((s, i) => {
      const g = GROUPS.find((x) => x.match.includes(s.status))!;
      const c = i % cols, r = Math.floor(i / cols);
      return { id: s.id, title: `${s.centreCode} · ${s.centreName} · ${STATUS_META[s.status].label}`, bg: STATUS_META[s.status].tile, group: g.key, d: Math.min(2.4, 0.9 + (c + r * 0.7) * 0.03).toFixed(3) };
    });
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.signatories.filter((s) =>
      (tab === "all" || (tab === "signed" ? s.status === "SIGNED" : tab === "unsent" ? s.status === "IMPORTED" : s.status !== "SIGNED")) &&
      (!needle || `${s.centreCode} ${s.centreName} ${s.name} ${s.mobile}`.toLowerCase().includes(needle)));
  }, [data, tab, q]);
  useEffect(() => setPage(0), [tab, q]);

  if (!data) return <div style={{ padding: 40 }}>{err ? <ErrorBox>{err}</ErrorBox> : <Spinner />}</div>;
  const { stats } = data;
  const pct = stats.total ? Math.round((stats.signed / stats.total) * 100) : 0;

  const copy = async (s: S) => { await navigator.clipboard.writeText(s.link); say(`Secure link for centre ${s.centreCode} copied`); };
  const sms = async (ids: string[] | null, scope?: string) => {
    setSending(true);
    try {
      const r = await api<{ sent: number; failed: number; error?: string }>(`/api/admin/projects/${id}/send`, { method: "POST", json: ids ? { ids } : { scope } });
      say(r.failed ? `Sent ${r.sent}, ${r.failed} failed · ${r.error ?? ""}` : `Link sent by SMS to ${r.sent} ${r.sent === 1 ? "signatory" : "signatories"}`, r.failed > 0);
      load();
    } catch (e) { say((e as Error).message, true); } finally { setSending(false); }
  };
  const whatsapp = async (s: S) => {
    try {
      const r = await api<{ url: string }>(`/api/admin/signatories/${s.id}/mark-sent`, { method: "POST" });
      window.open(r.url, "_blank", "noopener");
      load();
    } catch (e) { say((e as Error).message, true); }
  };

  const unsent = stats.byStatus.IMPORTED ?? 0;
  const kpis = [
    { label: "Signatories", v: stats.total, fg: "#142844", bar: "#142844", note: "1 per centre" },
    { label: "Links sent", v: stats.sent, fg: "#142844", bar: "#A8BBC2", note: `${unsent} not sent yet` },
    { label: "Opened", v: stats.opened, fg: "#2557DA", bar: "#2557DA", note: `${pctOf(stats.opened, stats.total)}% opened their link` },
    { label: "Uploaded", v: stats.uploaded, fg: "#7E5B12", bar: "#C9962B", note: `${pctOf(stats.uploaded, stats.total)}% uploaded a CSR` },
    { label: "Signed", v: stats.signed, fg: "#2E7567", bar: "#2E7567", note: `${pct}% done · ${stats.pending} to go` },
  ];
  const tabs = [
    { key: "all" as const, label: "All", n: stats.total },
    { key: "signed" as const, label: "Signed", n: stats.signed },
    { key: "pending" as const, label: "Pending", n: stats.pending },
    { key: "unsent" as const, label: "Not sent", n: unsent },
  ];
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div className="mono fade" style={{ fontSize: 12, color: "#637383" }}><Link href="/admin" style={{ color: "#637383" }}>Projects</Link> / <span style={{ color: "#142844" }}>{data.project.name}</span></div>
          <Kicker delay={0.2}>Live · updated {updated ? fmtTimeIST(updated) : ""}</Kicker>
          <h1 style={{ fontSize: "clamp(30px, 3.6vw, 48px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.04em" }}><Words text={data.project.name} start={0.3} /></h1>
          <div className="up mono" style={{ animationDelay: ".8s", fontSize: 12, color: "#637383" }}>{[data.project.examName, data.project.examDate, data.project.shift, `${stats.total} centres`].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="up" style={{ animationDelay: ".7s", display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="btn btn-line btn-sm" type="button" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add signatory</button>
          <Link className="btn btn-line btn-sm" href={`/admin/projects/${id}/import`}><Icon name="upload" size={16} /> Import CSV</Link>
          <a className="btn btn-line btn-sm" href={`/api/admin/projects/${id}/export`}><Icon name="sheet" size={16} /> Export Excel</a>
          <a className="btn btn-line btn-sm" href={stats.signed ? `/api/admin/projects/${id}/zip` : undefined} aria-disabled={!stats.signed} style={stats.signed ? undefined : { opacity: 0.4, pointerEvents: "none" }}><Icon name="download" size={16} /> ZIP · {stats.signed} signed</a>
          {unsent > 0 ? (
            <button className="btn btn-ink btn-sm" type="button" disabled={sending} onClick={() => sms(null, "unsent")}>{sending ? <Spinner /> : <Icon name="send" size={16} />} Send {unsent} links</button>
          ) : stats.pending > 0 ? (
            <button className="btn btn-ink btn-sm" type="button" disabled={sending} onClick={() => sms(null, "pending")}>{sending ? <Spinner /> : <Icon name="send" size={16} />} Remind {stats.pending} pending</button>
          ) : null}
        </div>
      </div>

      {!data.sms.linkSms && (
        <div className="note up" style={{ animationDelay: ".8s" }}>
          <Icon name="info" style={{ marginTop: 1 }} />
          <span>SMS for signing links needs a DLT-approved Authkey template. Set <b>AUTHKEY_LINK_SID</b> in <span className="mono">.env</span>. Until then, share links with WhatsApp or Copy link on each row. OTP SMS already works.</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        {kpis.map((x, i) => (
          <div key={x.label} className="card up lift" style={{ animationDelay: `${0.4 + i * 0.07}s`, padding: "18px 18px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" }}>{x.label}</span>
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: x.fg }}>{Math.round(x.v * k)}</span>
            <span style={{ height: 5, borderRadius: 3, background: "#E6ECEC", overflow: "hidden" }}><span className="grow" style={{ display: "block", height: "100%", width: `${stats.total ? (x.v / stats.total) * 100 : 0}%`, background: x.bar, borderRadius: 3, animationDelay: `${0.4 + i * 0.07}s`, transition: "width .6s ease" }} /></span>
            <span style={{ fontSize: 12.5, color: "#637383" }}>{x.note}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <section className="card up" style={{ animationDelay: ".9s", flex: "2 1 560px", minWidth: 0, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }} aria-label="Centre wall">
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Kicker delay={1}>Centre wall · one tile per centre</Kicker>
              <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>{Math.round(stats.signed * k)} of {stats.total} centres signed</h2>
            </div>
            <div style={{ position: "relative", width: 84, height: 84, flex: "none" }}>
              <svg width="84" height="84" viewBox="0 0 84 84" fill="none" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="42" cy="42" r="34" stroke="#E6ECEC" strokeWidth="9" />
                <circle cx="42" cy="42" r="34" stroke="#2E7567" strokeWidth="9" strokeLinecap="round" pathLength={100} strokeDasharray={`${(pct * k).toFixed(1)} 100`} />
              </svg>
              <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20, letterSpacing: "-0.03em" }}>{Math.round(pct * k)}%</span>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Focus a status">
            {GROUPS.map((g) => {
              const n = g.match.reduce((a, s) => a + (stats.byStatus[s] ?? 0), 0);
              const on = focus === g.key;
              return (
                <button key={g.key} className="tab" type="button" aria-pressed={on} onClick={() => setFocus(on ? null : g.key)} style={{ background: on ? "#DCECF2" : "#fff", borderColor: on ? "#142844" : "#D4DEE0", color: "#142844" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_META[g.match[0]].tile }} /> {g.label} <span className="mono" style={{ fontSize: 11, color: "#637383" }}>{n}</span>
                </button>
              );
            })}
          </div>
          {wall.length === 0 ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: "#637383" }}>No signatories yet. <Link href={`/admin/projects/${id}/import`}>Import a CSV</Link> or add one by hand.</div>
          ) : (
            <div className="wall" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${wall.length <= 60 ? 34 : wall.length <= 240 ? 20 : 13}px, 1fr))`, gap: wall.length <= 60 ? 6 : 3 }}>
              {wall.map((t) => (
                <button key={t.id} type="button" className="tile" title={t.title} aria-label={t.title} onClick={() => setSel(t.id)}
                  style={{ background: t.bg, opacity: !focus || focus === t.group ? 1 : 0.16, animationDelay: `${t.d}s`, border: 0, padding: 0, cursor: "pointer" }} />
              ))}
            </div>
          )}
        </section>

        <section className="card up" style={{ animationDelay: "1s", flex: "1 1 300px", minWidth: 0, padding: 22, display: "flex", flexDirection: "column", gap: 12 }} aria-label="Recent signatures">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Kicker delay={1.1}>Just signed</Kicker>
            <span className="live" />
          </div>
          {data.recent.length === 0 && <div style={{ color: "#637383", fontSize: 14, padding: "12px 0" }}>Signatures will appear here as they happen.</div>}
          {data.recent.map((r, i) => (
            <button key={r.id} type="button" className="row-btn up" onClick={() => setSel(r.id)} style={{ animationDelay: `${1.2 + i * 0.09}s`, display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #EEF2F1" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/admin/signatories/${r.id}/file?kind=photo`} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", background: "#2A4A78", flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0 }}><span className="ellipsis" style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{r.name}</span><span className="mono ellipsis" style={{ display: "block", fontSize: 11, color: "#637383", marginTop: 2 }}>Centre {r.centreCode} · {r.centreName}</span></span>
              <span className="mono" style={{ fontSize: 11.5, color: "#2E7567", fontWeight: 600 }}>{fmtTimeIST(r.signedAt)}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ borderRadius: 14, background: "#DCECF2", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase" }}>Signing pace</span>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{data.lastHour} in the last hour</span>
            <span style={{ fontSize: 12.5, color: "#3E5266" }}>{stats.pending ? (data.lastHour ? `At this pace, about ${Math.ceil(stats.pending / data.lastHour)} h to finish.` : `${stats.pending} centres still to sign.`) : "Every centre has signed."}</span>
          </div>
        </section>
      </div>

      <section className="card up" style={{ animationDelay: "1.1s", padding: 0, overflow: "hidden" }} aria-label="Signatories">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "18px 20px", borderBottom: "1px solid #E6ECEC" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }} role="tablist" aria-label="Filter by status">
            {tabs.map((t) => (
              <button key={t.key} className="tab" type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} style={{ background: tab === t.key ? "#142844" : "transparent", color: tab === t.key ? "#fff" : "#637383" }}>
                {t.label} <span className="mono" style={{ fontSize: 11, opacity: 0.75 }}>{t.n}</span>
              </button>
            ))}
          </div>
          <label style={{ position: "relative", flex: "0 1 300px", minWidth: 200 }}>
            <Icon name="search" size={16} color="#637383" stroke={2} style={{ position: "absolute", left: 14, top: 13 }} />
            <input className="field" style={{ height: 42, paddingLeft: 40, fontSize: 14 }} placeholder="Search centre, name, code or mobile" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search signatories" />
          </label>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 1120 }}>
            <div className="grid-row th" style={{ gridTemplateColumns: COLS }}><span>Code</span><span>Centre</span><span>Signatory</span><span>Status</span><span>eSigned at</span><span>Location</span><span style={{ textAlign: "right" }}>Actions</span></div>
            {shown.map((s, i) => {
              const signed = s.status === "SIGNED";
              return (
                <div key={s.id} className="grid-row tr up" style={{ gridTemplateColumns: COLS, animationDelay: `${Math.min(1.6, 1.2 + i * 0.03)}s` }}>
                  <span className="mono" style={{ fontWeight: 600 }}>{s.centreCode}</span>
                  <span style={{ minWidth: 0 }}><button className="row-btn" type="button" onClick={() => setSel(s.id)} style={{ fontWeight: 700 }}>{s.centreName}</button></span>
                  <span style={{ minWidth: 0 }}><span style={{ display: "block", fontWeight: 600 }}>{s.name}</span><span className="mono" style={{ display: "block", fontSize: 11, color: "#637383", marginTop: 3 }}>+91 {s.mobile}</span></span>
                  <span><Chip status={s.status} /></span>
                  <span className="mono" style={{ fontSize: 12.5, color: signed ? "#142844" : "#8C99A6" }}>{signed ? fmtIST(s.signedAt) : "Not yet"}</span>
                  <span className="mono" style={{ fontSize: 12, color: "#637383", display: "flex", alignItems: "center", gap: 6 }}>
                    {s.geoLat != null ? <><Icon name="pin" size={14} stroke={2} color="#2E7567" /><a href={`https://www.google.com/maps?q=${s.geoLat},${s.geoLng}`} target="_blank" rel="noopener noreferrer" style={{ color: "#637383" }}>{fmtGeo(s.geoLat, s.geoLng)}</a></> : "—"}
                  </span>
                  <span style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                    <button className="icon-btn" type="button" aria-label="Copy secure link" title="Copy secure link" onClick={() => copy(s)} disabled={signed}><Icon name="link" size={16} /></button>
                    <button className="icon-btn" type="button" aria-label="Send link by SMS" title={data.sms.linkSms ? "Send link by SMS" : "Link SMS template not set"} onClick={() => sms([s.id])} disabled={signed || !data.sms.linkSms || sending}><Icon name="sms" size={16} /></button>
                    <button className="icon-btn" type="button" aria-label="Send link on WhatsApp" title="Send link on WhatsApp" onClick={() => whatsapp(s)} disabled={signed}><Icon name="whatsapp" size={16} /></button>
                    <a className="icon-btn" aria-label="Download signed PDF" title="Download signed PDF" href={signed ? `/api/admin/signatories/${s.id}/file?kind=signed` : undefined} style={signed ? undefined : { opacity: 0.3, pointerEvents: "none" }}><Icon name="download" size={16} /></a>
                    <button className="icon-btn" type="button" aria-label="Open details" onClick={() => setSel(s.id)} style={{ background: "#142844", color: "#fff", borderColor: "#142844" }}><Icon name="next" size={16} /></button>
                  </span>
                </div>
              );
            })}
            {rows.length === 0 && <div style={{ padding: "40px 20px", textAlign: "center", color: "#637383" }}>{data.signatories.length ? "No centres match." : "No signatories yet."}</div>}
          </div>
        </div>
        <div className="mono" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #E6ECEC", fontSize: 11.5, color: "#637383" }}>
          <span>Showing {shown.length} of {rows.length}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="icon-btn" type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><Icon name="back" size={15} /></button>
            Page {page + 1} of {pages}
            <button className="icon-btn" type="button" aria-label="Next page" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><Icon name="next" size={15} /></button>
          </span>
        </div>
      </section>

      {sel && <SignatoryDrawer id={sel} smsReady={data.sms.linkSms} onClose={() => setSel(null)} onChanged={load} say={say} />}
      {adding && <AddSignatory projectId={id} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); load(); say("Signatory added · secure link created"); }} />}
      {toast}
    </div>
  );
}

const COLS = "78px minmax(220px, 2fr) minmax(170px, 1.2fr) 110px 190px 160px 210px";
const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function AddSignatory({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: () => void }) {
  const [f, setF] = useState({ name: "", mobile: "", centreCode: "", centreName: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === "mobile" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await api(`/api/admin/projects/${projectId}/signatories`, { method: "POST", json: f }); onAdded(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }} aria-label="Add signatory">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Kicker delay={0}>Add signatory</Kicker>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}><Icon name="close" size={16} stroke={2} /></button>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>One centre, one signatory</h2>
        <label><span className="label">Signatory name</span><input className="field" required autoFocus value={f.name} onChange={set("name")} /></label>
        <label><span className="label">Mobile</span><input className="field" required inputMode="numeric" value={f.mobile} onChange={set("mobile")} placeholder="10-digit number" /></label>
        <div style={{ display: "grid", gridTemplateColumns: "120px minmax(0,1fr)", gap: 12 }}>
          <label><span className="label">Centre code</span><input className="field" required value={f.centreCode} onChange={set("centreCode")} /></label>
          <label><span className="label">Centre name</span><input className="field" required value={f.centreName} onChange={set("centreName")} /></label>
        </div>
        <ErrorBox>{err}</ErrorBox>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-ink" type="submit" disabled={busy}>{busy ? <Spinner /> : null} Add</button>
        </div>
      </form>
    </div>
  );
}
