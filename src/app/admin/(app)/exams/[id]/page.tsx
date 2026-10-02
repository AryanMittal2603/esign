"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const [deleting, setDeleting] = useState(false);
  const [menu, setMenu] = useState(false);
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
      return { id: s.id, title: `${s.name} · ${s.centreCode} · ${STATUS_META[s.status].label}`, bg: STATUS_META[s.status].tile, group: g.key, d: Math.min(2.4, 0.9 + (c + r * 0.7) * 0.03).toFixed(3) };
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
    { label: "Signatories", v: stats.total, fg: "#142844", bar: "#142844", note: "one per centre" },
    { label: "Links sent", v: stats.sent, fg: "#142844", bar: "#A8BBC2", note: unsent ? `${unsent} not sent yet` : "all sent" },
    { label: "Opened", v: stats.opened, fg: "#2557DA", bar: "#2557DA", note: `${pctOf(stats.opened, stats.total)}% opened their link` },
    { label: "Uploaded", v: stats.uploaded, fg: "#7E5B12", bar: "#C9962B", note: `${pctOf(stats.uploaded, stats.total)}% uploaded a CSR` },
    { label: "Signed", v: stats.signed, fg: "#2E7567", bar: "#2E7567", note: stats.pending ? `${pct}% done · ${stats.pending} to go` : "all signed" },
  ];
  const tabs = [
    { key: "all" as const, label: "All", n: stats.total },
    { key: "signed" as const, label: "Signed", n: stats.signed },
    { key: "pending" as const, label: "Pending", n: stats.pending },
    { key: "unsent" as const, label: "Not sent", n: unsent },
  ];
  const facts = [
    ["Exam", data.project.examName],
    ["Date", data.project.examDate],
    ["Shift", data.project.shift],
    ["Signatories", String(stats.total)],
  ].filter(([, v]) => v) as [string, string][];
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="mono fade" style={{ fontSize: 12, color: "#637383", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span><Link href="/admin/exams" style={{ color: "#637383" }}>Exams</Link> / <span style={{ color: "#142844" }}>{data.project.name}</span></span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#2E7567" }}><span className="live" /> Live · updated {updated ? fmtTimeIST(updated) : ""}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <h1 style={{ fontSize: "clamp(28px, 3vw, 40px)", lineHeight: 1.05, fontWeight: 800, letterSpacing: "-0.035em", minWidth: 0 }}><Words text={data.project.name} start={0.2} /></h1>
          <div className="up" style={{ animationDelay: ".5s", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", position: "relative" }}>
            <button className="btn btn-line btn-sm" type="button" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add signatory</button>
            <Link className="btn btn-line btn-sm" href={`/admin/exams/${id}/import`}><Icon name="upload" size={16} /> Import CSV</Link>
            {unsent > 0 && data.sms.linkSms ? (
              <button className="btn btn-ink btn-sm" type="button" disabled={sending} onClick={() => sms(null, "unsent")}>{sending ? <Spinner /> : <Icon name="send" size={16} />} Send {unsent} {plural(unsent, "link", "links")}</button>
            ) : stats.pending > 0 && stats.sent > 0 && data.sms.linkSms ? (
              <button className="btn btn-ink btn-sm" type="button" disabled={sending} onClick={() => sms(null, "pending")}>{sending ? <Spinner /> : <Icon name="send" size={16} />} Remind {stats.pending} pending</button>
            ) : null}
            <button className="icon-btn" type="button" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu(!menu)} style={{ width: 38, height: 38 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
            </button>
            {menu && (
              <>
                <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} aria-hidden="true" />
                <div className="card pop" role="menu" style={{ position: "absolute", right: 0, top: 46, zIndex: 41, width: 240, padding: 6, display: "flex", flexDirection: "column" }}>
                  <a className="menu-item" role="menuitem" href={`/api/admin/projects/${id}/export`} onClick={() => setMenu(false)}><Icon name="sheet" size={16} /> Export Excel</a>
                  <a className="menu-item" role="menuitem" href={stats.signed ? `/api/admin/projects/${id}/zip` : undefined} aria-disabled={!stats.signed} onClick={() => setMenu(false)} style={stats.signed ? undefined : { opacity: 0.4, pointerEvents: "none" }}><Icon name="download" size={16} /> Download signed ZIP · {stats.signed}</a>
                  <div style={{ height: 1, background: "#E6ECEC", margin: "4px 6px" }} />
                  <button className="menu-item" role="menuitem" type="button" onClick={() => { setMenu(false); setDeleting(true); }} style={{ color: "#B23A3A" }}><Icon name="trash" size={16} /> Delete exam</button>
                </div>
              </>
            )}
          </div>
        </div>
        {facts.length > 0 && (
          <div className="up" style={{ animationDelay: ".4s", display: "flex", flexWrap: "wrap", gap: "6px 22px" }}>
            {facts.map(([k2, v]) => (
              <span key={k2} style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" }}>{k2}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{v}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <section className="card up" style={{ animationDelay: ".45s", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }} aria-label="Progress">
        {kpis.map((x, i) => (
          <div key={x.label} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8, borderLeft: i ? "1px solid #EEF2F1" : 0 }}>
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" }}>{x.label}</span>
            <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: x.fg }}>{Math.round(x.v * k)}</span>
            <span style={{ height: 4, borderRadius: 2, background: "#E6ECEC", overflow: "hidden" }}><span className="grow" style={{ display: "block", height: "100%", width: `${stats.total ? (x.v / stats.total) * 100 : 0}%`, background: x.bar, borderRadius: 2, animationDelay: `${0.5 + i * 0.07}s`, transition: "width .6s ease" }} /></span>
            <span style={{ fontSize: 12, color: "#637383" }}>{x.note}</span>
          </div>
        ))}
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <section className="card up" style={{ animationDelay: ".6s", flex: "2 1 520px", minWidth: 0, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }} aria-label="Signatory wall">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <Kicker delay={0.7}>Signatory wall · one tile each</Kicker>
              <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em" }}>{Math.round(stats.signed * k)} of {stats.total} {plural(stats.total, "signatory", "signatories")} signed</h2>
            </div>
            <div style={{ position: "relative", width: 68, height: 68, flex: "none" }}>
              <svg width="68" height="68" viewBox="0 0 84 84" fill="none" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="42" cy="42" r="34" stroke="#E6ECEC" strokeWidth="10" />
                <circle cx="42" cy="42" r="34" stroke="#2E7567" strokeWidth="10" strokeLinecap="round" pathLength={100} strokeDasharray={`${(pct * k).toFixed(1)} 100`} />
              </svg>
              <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 16, letterSpacing: "-0.03em" }}>{Math.round(pct * k)}%</span>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Focus a status">
            {GROUPS.map((g) => {
              const n = g.match.reduce((a, st) => a + (stats.byStatus[st] ?? 0), 0);
              const on = focus === g.key;
              return (
                <button key={g.key} className="tab" type="button" aria-pressed={on} onClick={() => setFocus(on ? null : g.key)} style={{ height: 30, padding: "0 10px", fontSize: 12.5, background: on ? "#DCECF2" : "#fff", borderColor: on ? "#142844" : "#D4DEE0", color: "#142844" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: STATUS_META[g.match[0]].tile }} /> {g.label} <span className="mono" style={{ fontSize: 11, color: "#637383" }}>{n}</span>
                </button>
              );
            })}
          </div>
          {wall.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "#637383" }}>No signatories yet. <Link href={`/admin/exams/${id}/import`}>Import a CSV</Link> or add one by hand.</div>
          ) : (
            <div className="wall" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${wall.length <= 60 ? 30 : wall.length <= 240 ? 20 : 13}px, 1fr))`, gap: wall.length <= 60 ? 6 : 3 }}>
              {wall.map((t) => (
                <button key={t.id} type="button" className="tile" title={t.title} aria-label={t.title} onClick={() => setSel(t.id)}
                  style={{ background: t.bg, opacity: !focus || focus === t.group ? 1 : 0.16, animationDelay: `${t.d}s`, border: 0, padding: 0, cursor: "pointer", maxWidth: 44 }} />
              ))}
            </div>
          )}
        </section>

        <section className="card up" style={{ animationDelay: ".7s", flex: "1 1 280px", minWidth: 0, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10 }} aria-label="Recent signatures">
          <Kicker delay={0.8}>Just signed</Kicker>
          {data.recent.length === 0 && <div style={{ color: "#637383", fontSize: 14, padding: "8px 0" }}>Signatures will appear here as they happen.</div>}
          {data.recent.map((r, i) => (
            <button key={r.id} type="button" className="row-btn up" onClick={() => setSel(r.id)} style={{ animationDelay: `${0.9 + i * 0.08}s`, display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #EEF2F1" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/admin/signatories/${r.id}/file?kind=photo`} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", background: "#2A4A78", flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0 }}><span className="ellipsis" style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{r.name}</span><span className="mono ellipsis" style={{ display: "block", fontSize: 11, color: "#637383", marginTop: 2 }}>{r.centreCode} · {r.centreName}</span></span>
              <span className="mono" style={{ fontSize: 11.5, color: "#2E7567", fontWeight: 600 }}>{fmtTimeIST(r.signedAt)}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ borderRadius: 14, background: "#DCECF2", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 3 }}>
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase" }}>Signing pace</span>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{data.lastHour} in the last hour</span>
            <span style={{ fontSize: 12.5, color: "#3E5266" }}>{stats.pending ? (data.lastHour ? `At this pace, about ${Math.ceil(stats.pending / data.lastHour)} h to finish.` : `${stats.pending} ${plural(stats.pending, "signatory", "signatories")} still to sign.`) : stats.total ? "Everyone has signed." : "Add signatories to begin."}</span>
          </div>
        </section>
      </div>

      <section className="card up" style={{ animationDelay: ".8s", padding: 0, overflow: "hidden" }} aria-label="Signatories">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid #E6ECEC" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }} role="tablist" aria-label="Filter by status">
            {tabs.map((t) => (
              <button key={t.key} className="tab" type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} style={{ background: tab === t.key ? "#142844" : "transparent", color: tab === t.key ? "#fff" : "#637383" }}>
                {t.label} <span className="mono" style={{ fontSize: 11, opacity: 0.75 }}>{t.n}</span>
              </button>
            ))}
          </div>
          <label style={{ position: "relative", flex: "0 1 300px", minWidth: 200 }}>
            <Icon name="search" size={16} color="#637383" stroke={2} style={{ position: "absolute", left: 14, top: 12 }} />
            <input className="field" style={{ height: 40, paddingLeft: 40, fontSize: 14 }} placeholder="Search name, mobile or centre" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search signatories" />
          </label>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 820 }}>
            <div className="grid-row th" style={{ gridTemplateColumns: COLS }}><span>Signatory</span><span>Centre</span><span>Status</span><span>eSigned</span><span style={{ textAlign: "right" }}>Actions</span></div>
            {shown.map((s, i) => {
              const signed = s.status === "SIGNED";
              return (
                <div key={s.id} className="grid-row tr up" style={{ gridTemplateColumns: COLS, animationDelay: `${Math.min(1.3, 0.9 + i * 0.03)}s` }}>
                  <span style={{ minWidth: 0 }}>
                    <button className="row-btn ellipsis" type="button" onClick={() => setSel(s.id)} style={{ display: "block", maxWidth: "100%", fontWeight: 700 }}>{s.name}</button>
                    <span className="mono" style={{ display: "block", fontSize: 11.5, color: "#637383", marginTop: 3 }}>+91 {s.mobile}</span>
                  </span>
                  <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="mono" style={{ flex: "none", fontSize: 11.5, fontWeight: 600, padding: "3px 7px", borderRadius: 6, background: "#EEF2F1" }}>{s.centreCode}</span>
                    <span className="ellipsis" title={s.centreName} style={{ minWidth: 0 }}>{s.centreName}</span>
                  </span>
                  <span><Chip status={s.status} /></span>
                  <span style={{ minWidth: 0 }}>
                    {signed ? (
                      <>
                        <span className="mono" style={{ display: "block", fontSize: 12.5 }}>{fmtIST(s.signedAt, false)}</span>
                        {s.geoLat != null && <a className="mono" href={`https://www.google.com/maps?q=${s.geoLat},${s.geoLng}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#637383", marginTop: 3 }}><Icon name="pin" size={12} stroke={2} color="#2E7567" />{fmtGeo(s.geoLat, s.geoLng)}</a>}
                      </>
                    ) : <span className="mono" style={{ fontSize: 12.5, color: "#8C99A6" }}>Not yet</span>}
                  </span>
                  <span style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                    {!signed && <button className="icon-btn" type="button" aria-label="Copy secure link" title="Copy secure link" onClick={() => copy(s)}><Icon name="link" size={16} /></button>}
                    {!signed && data.sms.linkSms && <button className="icon-btn" type="button" aria-label="Send link by SMS" title="Send link by SMS" onClick={() => sms([s.id])} disabled={sending}><Icon name="sms" size={16} /></button>}
                    {!signed && <button className="icon-btn" type="button" aria-label="Send link on WhatsApp" title="Send link on WhatsApp" onClick={() => whatsapp(s)}><Icon name="whatsapp" size={16} /></button>}
                    {signed && <a className="icon-btn" aria-label="Download signed PDF" title="Download signed PDF" href={`/api/admin/signatories/${s.id}/file?kind=signed`}><Icon name="download" size={16} /></a>}
                    <button className="icon-btn" type="button" aria-label="Open details" title="Open details" onClick={() => setSel(s.id)} style={{ background: "#142844", color: "#fff", borderColor: "#142844" }}><Icon name="next" size={16} /></button>
                  </span>
                </div>
              );
            })}
            {rows.length === 0 && <div style={{ padding: "36px 20px", textAlign: "center", color: "#637383" }}>{data.signatories.length ? "No signatories match." : "No signatories yet."}</div>}
          </div>
        </div>
        {rows.length > PAGE && (
          <div className="mono" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", borderTop: "1px solid #E6ECEC", fontSize: 11.5, color: "#637383" }}>
            <span>Showing {shown.length} of {rows.length}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="icon-btn" type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><Icon name="back" size={15} /></button>
              Page {page + 1} of {pages}
              <button className="icon-btn" type="button" aria-label="Next page" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><Icon name="next" size={15} /></button>
            </span>
          </div>
        )}
      </section>

      {sel && <SignatoryDrawer id={sel} smsReady={data.sms.linkSms} onClose={() => setSel(null)} onChanged={load} say={say} />}
      {adding && <AddSignatory projectId={id} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); load(); say("Signatory added · secure link created"); }} />}
      {deleting && <DeleteProject project={data.project} stats={stats} onClose={() => setDeleting(false)} />}
      {toast}
    </div>
  );
}

const COLS = "minmax(170px, 1.3fr) minmax(220px, 2fr) 112px 150px 168px";
const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

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

function DeleteProject({ project, stats, onClose }: { project: { id: string; name: string }; stats: { total: number; signed: number; uploaded: number }; onClose: () => void }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const match = typed.trim() === project.name.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match) return;
    setBusy(true); setErr("");
    try {
      await api(`/api/admin/projects/${project.id}`, { method: "DELETE", json: { confirm: typed } });
      router.replace("/admin/exams");
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="modal" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }} aria-label="Delete exam">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="kicker" style={{ color: "#B23A3A" }}>Delete exam</div>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose} disabled={busy}><Icon name="close" size={16} stroke={2} /></button>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>Delete “{project.name}” for good?</h2>
        <div style={{ borderRadius: 14, background: "#F6E2E0", color: "#6E1F1F", padding: "14px 16px", fontSize: 14, lineHeight: 1.55 }}>
          This permanently removes, and cannot be undone:
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            <li><b>{stats.total}</b> {stats.total === 1 ? "signatory" : "signatories"} and their secure links</li>
            <li><b>{stats.signed}</b> signed {stats.signed === 1 ? "CSR" : "CSRs"} and <b>{stats.uploaded}</b> uploaded {stats.uploaded === 1 ? "document" : "documents"}, with all live photos</li>
            <li>The exam&apos;s activity log and pending OTPs</li>
          </ul>
        </div>
        {stats.signed > 0 && (
          <div className="note"><Icon name="info" style={{ marginTop: 1 }} /><span>Download the <b>ZIP of signed CSRs</b> and the <b>Excel report</b> first if you need to keep them.</span></div>
        )}
        <label>
          <span className="label">Type the exam name to confirm</span>
          <input className="field" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={project.name} aria-label="Exam name" />
        </label>
        <ErrorBox>{err}</ErrorBox>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn" type="submit" disabled={!match || busy} style={{ background: "#B23A3A", color: "#fff" }}>{busy ? <><Spinner /> Deleting…</> : <><Icon name="trash" /> Delete permanently</>}</button>
        </div>
      </form>
    </div>
  );
}
