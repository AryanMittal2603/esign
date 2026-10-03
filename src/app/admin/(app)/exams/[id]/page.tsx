"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { Chip, ErrorBox, Icon, Kicker, Spinner, Words, api, useCountUp, useToast } from "@/components/ui";
import { fmtGeo, fmtIST, fmtTimeIST, type Status } from "@/lib/format";
import { SignatoryDrawer } from "@/components/admin/SignatoryDrawer";
import { WALL_COLORS, Wall } from "@/components/admin/Wall";
import { DeliveryBadge } from "@/components/admin/Delivery";

type Row = {
  id: string; name: string; mobile: string; centreCode: string; centreName: string; status: Status; link: string;
  linkSentAt: string | null; linkSentVia: string | null; signedAt: string | null; geoLat: number | null; geoLng: number | null;
  msgChannel: string | null; msgStatus: string | null; msgStatusAt: string | null; msgError: string | null;
};
type Summary = {
  project: { id: string; name: string; examName: string | null; examDate: string | null; shift: string | null };
  stats: { total: number; sent: number; opened: number; uploaded: number; signed: number; pending: number; byStatus: Record<Status, number> };
  recent: { id: string; name: string; centreCode: string; centreName: string; signedAt: string }[];
  lastHour: number;
  sms: { mode: string; linkSms: boolean; whatsapp: boolean };
  wall: string;
  delivery: { total: number; delivered: number; read: number; failed: number; pending: number };
  webhook: boolean;
};
type Tab = "all" | "signed" | "pending" | "unsent" | "failed";

const GROUPS: { key: string; label: string; count: (b: Record<Status, number>) => number }[] = [
  { key: "S", label: "Signed", count: (b) => b.SIGNED },
  { key: "U", label: "Uploaded", count: (b) => b.UPLOADED },
  { key: "O", label: "Opened", count: (b) => b.OPENED + b.VERIFIED },
  { key: "L", label: "Link sent", count: (b) => b.SENT },
  { key: "N", label: "Not sent", count: (b) => b.IMPORTED },
];
const PAGE = 50;
const ZIP_PART = 200;
const num = (n: number) => n.toLocaleString("en-IN");

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState("");
  const [table, setTable] = useState<{ rows: Row[]; total: number } | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [qd, setQd] = useState("");
  const [page, setPage] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menu, setMenu] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; via: string } | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const [toast, say] = useToast();
  const k = useCountUp([data === null]);

  const loadSummary = useCallback(async () => {
    try { const d = await api<Summary>(`/api/admin/projects/${id}`); setData(d); setUpdated(new Date()); setErr(""); setTick((t) => t + 1); }
    catch (e) { setErr((e as Error).message); }
  }, [id]);
  useEffect(() => { loadSummary(); const t = setInterval(loadSummary, 15000); return () => clearInterval(t); }, [loadSummary]);

  // debounce search
  useEffect(() => { const t = setTimeout(() => setQd(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => setPage(0), [tab, qd]);

  useEffect(() => {
    let live = true;
    const qs = new URLSearchParams({ tab, q: qd, page: String(page), size: String(PAGE) });
    api<{ rows: Row[]; total: number }>(`/api/admin/projects/${id}/signatories?${qs}`).then((r) => { if (live) setTable(r); }).catch(() => {});
    return () => { live = false; };
  }, [id, tab, qd, page, tick]);

  const refresh = () => loadSummary();

  /** Sends in batches of 200 until the server reports nothing remaining. */
  const send = async (ids: string[] | null, scope?: "unsent" | "pending", channel?: "sms" | "whatsapp") => {
    if (!data) return;
    const total = ids ? ids.length : scope === "unsent" ? data.stats.byStatus.IMPORTED : data.stats.pending;
    let done = 0, failed = 0, after: string | null = null, via = channel === "sms" ? "SMS" : "WhatsApp", lastError = "";
    setProgress({ done: 0, total, via });
    try {
      for (;;) {
        const r: { sent: number; failed: number; via: string; remaining: number; next: string | null; error?: string } =
          await api(`/api/admin/projects/${id}/send`, { method: "POST", json: { ...(ids ? { ids } : { scope }), ...(channel ? { channel } : {}), ...(after ? { after } : {}) } });
        done += r.sent + r.failed; failed += r.failed; via = r.via ?? via; if (r.error) lastError = r.error;
        setProgress({ done: Math.min(done, total), total, via });
        if (!r.next || !r.remaining) break;
        after = r.next;
      }
      const sent = done - failed;
      say(failed ? `Sent ${num(sent)} on ${via}, ${num(failed)} failed · ${lastError}` : `Sent on ${via} to ${num(sent)} ${sent === 1 ? "signatory" : "signatories"}`, failed > 0);
    } catch (e) { say((e as Error).message, true); }
    finally { setProgress(null); refresh(); }
  };
  const whatsapp = async (r: Row) => {
    if (data?.sms.whatsapp) return send([r.id], undefined, "whatsapp");
    try { const w = await api<{ url: string }>(`/api/admin/signatories/${r.id}/mark-sent`, { method: "POST" }); window.open(w.url, "_blank", "noopener"); refresh(); }
    catch (e) { say((e as Error).message, true); }
  };
  const copy = async (r: Row) => { await navigator.clipboard.writeText(r.link); say(`Secure link for ${r.name} copied`); };
  const pickTile = async (i: number) => {
    try { const r = await api<{ id: string }>(`/api/admin/projects/${id}/signatories?at=${i}`); setSel(r.id); } catch { /* row vanished */ }
  };

  if (!data) return <div style={{ padding: 40 }}>{err ? <ErrorBox>{err}</ErrorBox> : <Spinner />}</div>;
  const { stats } = data;
  const pct = stats.total ? Math.round((stats.signed / stats.total) * 100) : 0;
  const unsent = stats.byStatus.IMPORTED ?? 0;
  const canSend = data.sms.whatsapp || data.sms.linkSms;
  const zipParts = Math.ceil(stats.signed / ZIP_PART);
  const facts = ([["Exam", data.project.examName], ["Date", data.project.examDate], ["Shift", data.project.shift]] as const).filter(([, v]) => v) as [string, string][];
  const stages = [
    { label: "Links sent", v: stats.sent, fg: "#142844", bar: "#A8BBC2", note: unsent ? `${num(unsent)} not sent yet` : "all sent" },
    { label: "Opened", v: stats.opened, fg: "#2557DA", bar: "#2557DA", note: `${pctOf(stats.opened, stats.total)}% of signatories` },
    { label: "Uploaded", v: stats.uploaded, fg: "#7E5B12", bar: "#C9962B", note: `${pctOf(stats.uploaded, stats.total)}% uploaded a CSR` },
    { label: "Signed", v: stats.signed, fg: "#2E7567", bar: "#2E7567", note: stats.pending ? `${num(stats.pending)} still to sign` : stats.total ? "everyone signed" : "—" },
  ];
  const tabs: { key: Tab; label: string; n: number }[] = [
    { key: "all", label: "All", n: stats.total },
    { key: "signed", label: "Signed", n: stats.signed },
    { key: "pending", label: "Pending", n: stats.pending },
    { key: "unsent", label: "Not sent", n: unsent },
    ...(data.delivery.failed ? [{ key: "failed" as Tab, label: "Delivery failed", n: data.delivery.failed }] : []),
  ];
  const dv = data.delivery;
  const rows = table?.rows ?? [];
  const total = table?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* header */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="mono fade" style={{ fontSize: 12, color: "#637383", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span><Link href="/admin/exams" style={{ color: "#637383" }}>Exams</Link> / <span style={{ color: "#142844" }}>{data.project.name}</span></span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#2E7567" }}><span className="live" /> Live · updated {updated ? fmtTimeIST(updated) : ""}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <h1 style={{ fontSize: "clamp(28px, 3vw, 40px)", lineHeight: 1.05, fontWeight: 800, letterSpacing: "-0.035em", minWidth: 0 }}><Words text={data.project.name} start={0.2} /></h1>
          <div className="up" style={{ animationDelay: ".4s", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", position: "relative" }}>
            <button className="btn btn-line btn-sm" type="button" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add signatory</button>
            <Link className="btn btn-line btn-sm" href={`/admin/exams/${id}/import`}><Icon name="upload" size={16} /> Import CSV</Link>
            {canSend && unsent > 0 ? (
              <button className="btn btn-ink btn-sm" type="button" disabled={!!progress} onClick={() => send(null, "unsent")}><Icon name={data.sms.whatsapp ? "whatsapp" : "send"} size={16} /> Send {num(unsent)} {plural(unsent, "link", "links")}</button>
            ) : canSend && stats.pending > 0 && stats.sent > 0 ? (
              <button className="btn btn-ink btn-sm" type="button" disabled={!!progress} onClick={() => send(null, "pending")}><Icon name={data.sms.whatsapp ? "whatsapp" : "send"} size={16} /> Remind {num(stats.pending)} pending</button>
            ) : null}
            <button className="icon-btn" type="button" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu(!menu)} style={{ width: 38, height: 38 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
            </button>
            {menu && (
              <>
                <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} aria-hidden="true" />
                <div className="card pop" role="menu" style={{ position: "absolute", right: 0, top: 46, zIndex: 41, width: 260, padding: 6, display: "flex", flexDirection: "column", maxHeight: 360, overflowY: "auto" }}>
                  <a className="menu-item" role="menuitem" href={`/api/admin/projects/${id}/export`} onClick={() => setMenu(false)}><Icon name="sheet" size={16} /> Export Excel</a>
                  {zipParts <= 1 ? (
                    <a className="menu-item" role="menuitem" href={stats.signed ? `/api/admin/projects/${id}/zip` : undefined} aria-disabled={!stats.signed} onClick={() => setMenu(false)} style={stats.signed ? undefined : { opacity: 0.4, pointerEvents: "none" }}><Icon name="download" size={16} /> Signed CSRs (ZIP) · {num(stats.signed)}</a>
                  ) : (
                    <>
                      <div className="mono" style={{ padding: "8px 12px 4px", fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "#637383" }}>Signed CSRs · {zipParts} ZIP parts</div>
                      {Array.from({ length: zipParts }, (_, i) => (
                        <a key={i} className="menu-item" role="menuitem" href={`/api/admin/projects/${id}/zip?part=${i + 1}`} style={{ padding: "8px 12px" }}>
                          <Icon name="download" size={15} /> Part {i + 1} <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "#637383" }}>{num(i * ZIP_PART + 1)}–{num(Math.min(stats.signed, (i + 1) * ZIP_PART))}</span>
                        </a>
                      ))}
                    </>
                  )}
                  <div style={{ height: 1, background: "#E6ECEC", margin: "4px 6px" }} />
                  <button className="menu-item" role="menuitem" type="button" onClick={() => { setMenu(false); setDeleting(true); }} style={{ color: "#B23A3A" }}><Icon name="trash" size={16} /> Delete exam</button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="up" style={{ animationDelay: ".35s", display: "flex", flexWrap: "wrap", gap: "6px 22px" }}>
          {facts.map(([k2, v]) => (
            <span key={k2} style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" }}>{k2}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{v}</span>
            </span>
          ))}
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" }}>Signatories</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{num(stats.total)}</span>
          </span>
        </div>
      </div>

      {progress && (
        <div className="card pop" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }} role="status">
          <Spinner />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Sending on {progress.via} · {num(progress.done)} of {num(progress.total)}</div>
            <div style={{ height: 6, borderRadius: 3, background: "#E6ECEC", overflow: "hidden", marginTop: 8 }}>
              <div style={{ height: "100%", width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: "#142844", transition: "width .4s ease" }} />
            </div>
          </div>
          <span className="mono" style={{ fontSize: 12, color: "#637383" }}>Keep this page open</span>
        </div>
      )}

      {/* funnel */}
      <section className="card up" style={{ animationDelay: ".45s", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }} aria-label="Progress">
        {stages.map((x, i) => (
          <div key={x.label} style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 8, borderLeft: i ? "1px solid #EEF2F1" : 0, position: "relative" }}>
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" }}>{x.label}</span>
              <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: x.fg }}>{pctOf(x.v, stats.total)}%</span>
            </span>
            <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: x.fg }}>{num(Math.round(x.v * k))}</span>
            <span style={{ height: 4, borderRadius: 2, background: "#E6ECEC", overflow: "hidden" }}><span className="grow" style={{ display: "block", height: "100%", width: `${stats.total ? (x.v / stats.total) * 100 : 0}%`, background: x.bar, borderRadius: 2, animationDelay: `${0.5 + i * 0.07}s`, transition: "width .6s ease" }} /></span>
            <span style={{ fontSize: 12, color: "#637383" }}>{x.note}</span>
          </div>
        ))}
      </section>

      {dv.total > 0 && (
        <section className="card up" style={{ animationDelay: ".5s", padding: "14px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 26px" }} aria-label="WhatsApp delivery">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 14 }}>
            <Icon name="whatsapp" size={18} color="#2E7567" /> WhatsApp delivery
          </span>
          {[
            ["Messages", dv.total, "#142844"],
            ["Delivered", dv.delivered, "#142844"],
            ["Read", dv.read, "#2557DA"],
            ["Awaiting receipt", dv.pending, "#637383"],
          ].map(([l, v, c]) => (
            <span key={l as string} style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: c as string }}>{num(v as number)}</span>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "#637383" }}>{l as string}{l !== "Messages" && l !== "Awaiting receipt" ? ` · ${pctOf(v as number, dv.total)}%` : ""}</span>
            </span>
          ))}
          {dv.failed > 0 && (
            <button className="tab" type="button" onClick={() => setTab("failed")} style={{ height: 30, background: "#F6E2E0", color: "#8E2B2B", borderColor: "#E9C3BE" }}>
              {num(dv.failed)} failed · view
            </button>
          )}
          {!data.webhook && <span style={{ fontSize: 12.5, color: "#9A5530" }}>Delivery receipts aren&apos;t connected yet, so statuses stay at “Sending”.</span>}
        </section>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <section className="card up" style={{ animationDelay: ".55s", flex: "2 1 520px", minWidth: 0, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }} aria-label="Signatory wall">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9A5530" }}>Signatory wall · current stage</span>
              <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em" }}>{num(Math.round(stats.signed * k))} of {num(stats.total)} signed</h2>
            </div>
            <div style={{ position: "relative", width: 64, height: 64, flex: "none" }}>
              <svg width="64" height="64" viewBox="0 0 84 84" fill="none" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="42" cy="42" r="34" stroke="#E6ECEC" strokeWidth="10" />
                <circle cx="42" cy="42" r="34" stroke="#2E7567" strokeWidth="10" strokeLinecap="round" pathLength={100} strokeDasharray={`${(pct * k).toFixed(1)} 100`} />
              </svg>
              <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontWeight: 800, fontSize: pct === 100 ? 13 : 15, letterSpacing: "-0.03em" }}>{Math.round(pct * k)}%</span>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Highlight a stage">
            {GROUPS.map((g) => {
              const n = g.count(stats.byStatus);
              const on = focus === g.key;
              return (
                <button key={g.key} className="tab" type="button" aria-pressed={on} onClick={() => setFocus(on ? null : g.key)} style={{ height: 30, padding: "0 10px", fontSize: 12.5, background: on ? "#DCECF2" : "#fff", borderColor: on ? "#142844" : "#D4DEE0", color: "#142844" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: WALL_COLORS[g.key] }} /> {g.label} <span className="mono" style={{ fontSize: 11, color: "#637383" }}>{num(n)}</span>
                </button>
              );
            })}
          </div>
          {data.wall.length === 0
            ? <div style={{ padding: "22px 0", textAlign: "center", color: "#637383" }}>No signatories yet. <Link href={`/admin/exams/${id}/import`}>Import a CSV</Link> or add one by hand.</div>
            : <Wall codes={data.wall} focus={focus} onPick={pickTile} />}
        </section>

        <section className="card up" style={{ animationDelay: ".65s", flex: "1 1 280px", minWidth: 0, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10 }} aria-label="Recent signatures">
          <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9A5530" }}>Just signed</span>
          {data.recent.length === 0 && <div style={{ color: "#637383", fontSize: 14, padding: "6px 0" }}>Signatures will appear here as they happen.</div>}
          {data.recent.map((r, i) => (
            <button key={r.id} type="button" className="row-btn up" onClick={() => setSel(r.id)} style={{ animationDelay: `${0.8 + i * 0.07}s`, display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #EEF2F1" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/admin/signatories/${r.id}/file?kind=photo`} alt="" loading="lazy" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", background: "#2A4A78", flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0 }}><span className="ellipsis" style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{r.name}</span><span className="mono ellipsis" style={{ display: "block", fontSize: 11, color: "#637383", marginTop: 2 }}>{r.centreCode} · {r.centreName}</span></span>
              <span className="mono" style={{ fontSize: 11.5, color: "#2E7567", fontWeight: 600 }}>{fmtTimeIST(r.signedAt)}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ borderRadius: 14, background: "#DCECF2", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 3 }}>
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase" }}>Signing pace</span>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{num(data.lastHour)} in the last hour</span>
            <span style={{ fontSize: 12.5, color: "#3E5266" }}>{stats.pending ? (data.lastHour ? `At this pace, about ${Math.ceil(stats.pending / data.lastHour)} h to finish.` : `${num(stats.pending)} ${plural(stats.pending, "signatory", "signatories")} still to sign.`) : stats.total ? "Everyone has signed." : "Add signatories to begin."}</span>
          </div>
        </section>
      </div>

      {/* table */}
      <section className="card up" style={{ animationDelay: ".75s", padding: 0, overflow: "hidden" }} aria-label="Signatories">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid #E6ECEC" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }} role="tablist" aria-label="Filter by status">
            {tabs.map((t) => (
              <button key={t.key} className="tab" type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} style={{ background: tab === t.key ? "#142844" : "transparent", color: tab === t.key ? "#fff" : "#637383" }}>
                {t.label} <span className="mono" style={{ fontSize: 11, opacity: 0.75 }}>{num(t.n)}</span>
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
            <div className="grid-row th" style={{ gridTemplateColumns: COLS }}><span>Signatory</span><span>Centre</span><span>Status</span><span>eSigned / invite</span><span style={{ textAlign: "right" }}>Actions</span></div>
            {table === null && <div style={{ padding: 30 }}><Spinner /></div>}
            {rows.map((r) => {
              const signed = r.status === "SIGNED";
              return (
                <div key={r.id} className="grid-row tr" style={{ gridTemplateColumns: COLS }}>
                  <span style={{ minWidth: 0 }}>
                    <button className="row-btn ellipsis" type="button" onClick={() => setSel(r.id)} style={{ display: "block", maxWidth: "100%", fontWeight: 700 }}>{r.name}</button>
                    <span className="mono" style={{ display: "block", fontSize: 11.5, color: "#637383", marginTop: 3 }}>+91 {r.mobile}</span>
                  </span>
                  <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="mono" style={{ flex: "none", fontSize: 11.5, fontWeight: 600, padding: "3px 7px", borderRadius: 6, background: "#EEF2F1" }}>{r.centreCode}</span>
                    <span className="ellipsis" title={r.centreName} style={{ minWidth: 0 }}>{r.centreName}</span>
                  </span>
                  <span><Chip status={r.status} /></span>
                  <span style={{ minWidth: 0 }}>
                    {signed ? (
                      <>
                        <span className="mono" style={{ display: "block", fontSize: 12.5 }}>{fmtIST(r.signedAt, false)}</span>
                        {r.geoLat != null && <a className="mono" href={`https://www.google.com/maps?q=${r.geoLat},${r.geoLng}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#637383", marginTop: 3 }}><Icon name="pin" size={12} stroke={2} color="#2E7567" />{fmtGeo(r.geoLat, r.geoLng)}</a>}
                      </>
                    ) : r.msgStatus ? (
                      <DeliveryBadge status={r.msgStatus} at={r.msgStatusAt} error={r.msgError} channel={r.msgChannel} />
                    ) : <span className="mono" style={{ fontSize: 12.5, color: "#8C99A6" }}>{r.linkSentVia ? `Sent on ${r.linkSentVia}` : "Not sent yet"}</span>}
                  </span>
                  <span style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                    {!signed && <button className="icon-btn" type="button" aria-label="Copy secure link" title="Copy secure link" onClick={() => copy(r)}><Icon name="link" size={16} /></button>}
                    {!signed && data.sms.linkSms && <button className="icon-btn" type="button" aria-label="Send link by SMS" title="Send link by SMS" onClick={() => send([r.id], undefined, "sms")} disabled={!!progress}><Icon name="sms" size={16} /></button>}
                    {!signed && <button className="icon-btn" type="button" aria-label="Send link on WhatsApp" title="Send link on WhatsApp" onClick={() => whatsapp(r)} disabled={!!progress}><Icon name="whatsapp" size={16} /></button>}
                    {signed && <a className="icon-btn" aria-label="Download signed PDF" title="Download signed PDF" href={`/api/admin/signatories/${r.id}/file?kind=signed`}><Icon name="download" size={16} /></a>}
                    <button className="icon-btn" type="button" aria-label="Open details" title="Open details" onClick={() => setSel(r.id)} style={{ background: "#142844", color: "#fff", borderColor: "#142844" }}><Icon name="next" size={16} /></button>
                  </span>
                </div>
              );
            })}
            {table && rows.length === 0 && <div style={{ padding: "36px 20px", textAlign: "center", color: "#637383" }}>{stats.total ? "No signatories match." : "No signatories yet."}</div>}
          </div>
        </div>
        {total > 0 && (
          <div className="mono" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 18px", borderTop: "1px solid #E6ECEC", fontSize: 11.5, color: "#637383" }}>
            <span>{num(page * PAGE + 1)}–{num(Math.min(total, (page + 1) * PAGE))} of {num(total)}</span>
            {pages > 1 && (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button className="icon-btn" type="button" aria-label="First page" disabled={page === 0} onClick={() => setPage(0)} style={{ width: "auto", padding: "0 8px", fontSize: 11 }}>First</button>
                <button className="icon-btn" type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><Icon name="back" size={15} /></button>
                <span style={{ padding: "0 6px" }}>Page {num(page + 1)} of {num(pages)}</span>
                <button className="icon-btn" type="button" aria-label="Next page" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><Icon name="next" size={15} /></button>
                <button className="icon-btn" type="button" aria-label="Last page" disabled={page + 1 >= pages} onClick={() => setPage(pages - 1)} style={{ width: "auto", padding: "0 8px", fontSize: 11 }}>Last</button>
              </span>
            )}
          </div>
        )}
      </section>

      {sel && <SignatoryDrawer id={sel} smsReady={data.sms.linkSms} waReady={data.sms.whatsapp} onClose={() => setSel(null)} onChanged={refresh} say={say} />}
      {adding && <AddSignatory projectId={id} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); refresh(); say("Signatory added · secure link created"); }} />}
      {deleting && <DeleteProject project={data.project} stats={stats} onClose={() => setDeleting(false)} />}
      {toast}
    </div>
  );
}

const COLS = "minmax(170px, 1.3fr) minmax(200px, 1.8fr) 112px 190px 168px";
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
