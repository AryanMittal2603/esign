"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { ErrorBox, Icon, Kicker, Spinner, Words, api, useCountUp, useToast } from "@/components/ui";
import { customName, examTitle, fmtGeo, fmtIST, fmtTimeIST, type Status } from "@/lib/format";
import { SignatoryDrawer } from "@/components/admin/SignatoryDrawer";
import { Impression } from "@/components/admin/Impression";
import { CSR_META, CsrPill, DELIVERY_META, DeliveryPill, type CsrKey, type DeliveryKey } from "@/components/admin/Pills";
import { Dropdown } from "@/components/admin/Dropdown";

const DELIVERY_DOT: Record<DeliveryKey, string> = { notsent: "#CBD5E1", sending: "#94A3B8", sent: "#64748B", delivered: "#4A6A94", read: "#1F3A5F", failed: "#A65B30" };

type Row = {
  id: string; name: string; mobile: string; centreCode: string; centreName: string; status: Status; link: string;
  linkSentAt: string | null; linkSentVia: string | null; signedAt: string | null; geoLat: number | null; geoLng: number | null;
  msgChannel: string | null; msgStatus: string | null; msgStatusAt: string | null; msgError: string | null;
  liveness: string | null; impression: string | null;
};
type Summary = {
  project: { id: string; name: string; examName: string | null; examDate: string | null; shift: string | null };
  stats: { total: number; sent: number; opened: number; uploaded: number; signed: number; pending: number; byStatus: Record<Status, number> };
  counts: { csr: Record<CsrKey, number>; delivery: Record<DeliveryKey, number> };
  sms: { mode: string; linkSms: boolean; whatsapp: boolean };
  webhook: boolean;
};

const PAGE = 50;
const ZIP_PART = 200;
const num = (n: number) => n.toLocaleString("en-IN");

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState("");
  const [table, setTable] = useState<{ rows: Row[]; total: number } | null>(null);
  const [csr, setCsr] = useState<CsrKey | "">("");
  const [delivery, setDelivery] = useState<DeliveryKey | "">("");
  const [q, setQ] = useState("");
  const [qd, setQd] = useState("");
  const [page, setPage] = useState(0);
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

  useEffect(() => { const t = setTimeout(() => setQd(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => setPage(0), [csr, delivery, qd]);

  useEffect(() => {
    let live = true;
    const qs = new URLSearchParams({ q: qd, page: String(page), size: String(PAGE), ...(csr ? { csr } : {}), ...(delivery ? { delivery } : {}) });
    api<{ rows: Row[]; total: number }>(`/api/admin/projects/${id}/signatories?${qs}`).then((r) => { if (live) setTable(r); }).catch(() => {});
    return () => { live = false; };
  }, [id, csr, delivery, qd, page, tick]);

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

  if (!data) return <div style={{ padding: 40 }}>{err ? <ErrorBox>{err}</ErrorBox> : <Spinner />}</div>;
  const { stats, counts } = data;
  const unsent = stats.byStatus.IMPORTED ?? 0;
  const canSend = data.sms.whatsapp || data.sms.linkSms;
  const zipParts = Math.ceil(stats.signed / ZIP_PART);
  const dv = counts.delivery;
  const messaged = stats.total - dv.notsent;
  const stages: { label: string; v: number; fg: string; bar: string; note: string; pct?: boolean; also?: { v: number; label: string; fg: string; bar: string } }[] = [
    { label: "Signatories", v: stats.total, fg: "#142844", bar: "#142844", pct: false, note: dv.notsent ? `${num(messaged)} invited · ${num(dv.notsent)} not sent yet` : stats.total ? "everyone invited" : "none added yet" },
    { label: "Delivered", v: dv.delivered + dv.read, fg: "#1F3A5F", bar: "#4A6A94", note: `${num(dv.read)} read · ${num(dv.failed)} failed` },
    { label: "Opened & uploaded", v: stats.opened, fg: "#2F4F7A", bar: "#A7B9D1", note: `${num(stats.opened - stats.uploaded)} opened, not uploaded yet`, also: { v: stats.uploaded, label: "uploaded", fg: "#A65B30", bar: "#DDAE8E" } },
    { label: "Signed", v: stats.signed, fg: "#B76A3B", bar: "#B76A3B", note: stats.pending ? `${num(stats.pending)} still to sign` : stats.total ? "everyone signed" : "—" },
  ];
  const rows = table?.rows ?? [];
  const total = table?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const filtered = !!(csr || delivery || qd);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* header — its own stacking layer above the animated cards, so the ⋯ menu isn't covered */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16, position: "relative", zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 340px" }}>
          <Link href="/admin/exams" className="icon-btn fade" aria-label="Back to exams" data-tip="Back to exams" style={{ width: 38, height: 38, flex: "none" }}><Icon name="back" size={18} stroke={2} /></Link>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: "clamp(26px, 2.6vw, 34px)", lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.03em" }}><Words text={examTitle(data.project).split(" · ").map((part) => part.replace(/ /g, "\u00a0")).join(" · ")} start={0.15} step={0.05} /></h1>
            {customName(data.project) && <div className="fade" style={{ animationDelay: ".4s", fontSize: 13, color: "#64748B", marginTop: 4 }}>{customName(data.project)}</div>}
          </div>
        </div>
        <div className="up" style={{ animationDelay: ".3s", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "flex-end", position: "relative", zIndex: 2, flex: "0 1 auto" }}>
          <span className="live-pill" data-tip={updated ? `Refreshes every 15 seconds · last ${fmtTimeIST(updated)}` : undefined}><span className="live" /> Live{updated ? ` · ${fmtTimeIST(updated).slice(0, 5)}` : ""}</span>
          <button className="btn btn-line btn-sm" type="button" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add signatory</button>
          <Link className="btn btn-line btn-sm" href={`/admin/exams/${id}/import`}><Icon name="upload" size={16} /> Import CSV</Link>
          {canSend && unsent > 0 ? (
            <button className="btn btn-ink btn-sm" type="button" disabled={!!progress} onClick={() => send(null, "unsent")}><Icon name={data.sms.whatsapp ? "whatsapp" : "send"} size={16} /> Send {num(unsent)} {plural(unsent, "invite", "invites")}</button>
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
                    <div className="mono" style={{ padding: "8px 12px 4px", fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "#64748B" }}>Signed CSRs · {zipParts} ZIP parts</div>
                    {Array.from({ length: zipParts }, (_, i) => (
                      <a key={i} className="menu-item" role="menuitem" href={`/api/admin/projects/${id}/zip?part=${i + 1}`} style={{ padding: "8px 12px" }}>
                        <Icon name="download" size={15} /> Part {i + 1} <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "#64748B" }}>{num(i * ZIP_PART + 1)}–{num(Math.min(stats.signed, (i + 1) * ZIP_PART))}</span>
                      </a>
                    ))}
                  </>
                )}
                <div style={{ height: 1, background: "#E2E8F0", margin: "4px 6px" }} />
                <button className="menu-item" role="menuitem" type="button" onClick={() => { setMenu(false); setDeleting(true); }} style={{ color: "#8C3B1E" }}><Icon name="trash" size={16} /> Delete exam</button>
              </div>
            </>
          )}
        </div>
      </div>

      {progress && (
        <div className="card pop" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }} role="status">
          <Spinner />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Sending on {progress.via} · {num(progress.done)} of {num(progress.total)}</div>
            <div style={{ height: 6, borderRadius: 3, background: "#E2E8F0", overflow: "hidden", marginTop: 8 }}>
              <div style={{ height: "100%", width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: "#0F172A", transition: "width .4s ease" }} />
            </div>
          </div>
          <span className="mono" style={{ fontSize: 12, color: "#64748B" }}>Keep this page open</span>
        </div>
      )}

      {/* funnel */}
      <section className="card up funnel" style={{ animationDelay: ".45s", padding: 0, overflow: "hidden" }} aria-label="Progress">
        {stages.map((x, i) => (
          <div key={x.label} className="funnel-cell" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#64748B" }}>{x.label}</span>
              {x.pct !== false && <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: x.fg }}>{pctOf(x.v, stats.total)}%</span>}
            </span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: x.fg }} data-tip={x.also ? "Opened their link" : undefined}>{num(Math.round(x.v * k))}</span>
              {x.also && (
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }} data-tip="Uploaded a CSR">
                  <span style={{ fontSize: 22, fontWeight: 300, color: "#CBD5E1", lineHeight: 1 }}>/</span>
                  <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: x.also.fg }}>{num(Math.round(x.also.v * k))}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: x.also.fg }}>{x.also.label}</span>
                </span>
              )}
            </span>
            <span style={{ position: "relative", height: 4, borderRadius: 2, background: "#EEF2F6", overflow: "hidden" }}>
              <span className="grow" style={{ display: "block", height: "100%", width: `${stats.total ? (x.v / stats.total) * 100 : 0}%`, background: x.bar, borderRadius: 2, animationDelay: `${0.5 + i * 0.06}s`, transition: "width .6s ease" }} />
              {x.also && <span className="grow" style={{ position: "absolute", left: 0, top: 0, display: "block", height: "100%", width: `${stats.total ? (x.also.v / stats.total) * 100 : 0}%`, background: x.also.bar, borderRadius: 2, animationDelay: `${0.56 + i * 0.06}s`, transition: "width .6s ease" }} />}
            </span>
            <span style={{ fontSize: 12, color: "#64748B" }}>{x.note}</span>
          </div>
        ))}
      </section>
      {!data.webhook && messaged > 0 && (
        <div className="note"><Icon name="info" style={{ marginTop: 1 }} /> Delivery receipts aren&apos;t connected, so WhatsApp messages stay at “Sending”.</div>
      )}

      {/* table */}
      <section className="card up" style={{ animationDelay: ".55s", padding: 0, position: "relative", zIndex: 1 }} aria-label="Signatories">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid #E2E8F0", position: "relative", zIndex: 5 }}>
          <Dropdown
            label="CSR status"
            ariaLabel="Filter by CSR status"
            value={csr}
            onChange={(v) => setCsr(v as CsrKey | "")}
            options={[{ value: "", label: "All", count: stats.total }, ...(Object.keys(CSR_META) as CsrKey[]).map((key) => ({ value: key, label: CSR_META[key].label, count: counts.csr[key], dot: CSR_META[key].dot }))]}
          />
          <Dropdown
            label="Message delivery"
            ariaLabel="Filter by message delivery"
            value={delivery}
            onChange={(v) => setDelivery(v as DeliveryKey | "")}
            options={[{ value: "", label: "All", count: stats.total }, ...(Object.keys(DELIVERY_META) as DeliveryKey[]).map((key) => ({ value: key, label: DELIVERY_META[key].label, count: dv[key], dot: DELIVERY_DOT[key] }))]}
          />
          {filtered && <button className="link" type="button" style={{ fontSize: 13 }} onClick={() => { setCsr(""); setDelivery(""); setQ(""); }}>Clear filters</button>}
          <div style={{ flex: 1 }} />
          <label style={{ position: "relative", flex: "0 1 300px", minWidth: 220 }}>
            <Icon name="search" size={16} color="#64748B" stroke={2} style={{ position: "absolute", left: 13, top: 11 }} />
            <input className="field" style={{ height: 38, paddingLeft: 38, fontSize: 14, borderRadius: 10 }} placeholder="Search name, mobile or centre" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search signatories" />
          </label>
        </div>
        <div style={{ overflowX: "auto", borderRadius: total > 0 ? 0 : "0 0 16px 16px" }}>
          <div className="tbl" style={{ minWidth: 1016 }}>
            <div className="tbl-row tbl-head" style={{ gridTemplateColumns: COLS }}>
              <span>Signatory</span><span>Centre</span><span>Message delivery</span><span>CSR status</span><span>eSigned at</span><span>Impression</span><span style={{ justifyContent: "flex-end" }}>Actions</span>
            </div>
            {table === null && <div style={{ padding: 30 }}><Spinner /></div>}
            {rows.map((r) => {
              const signed = r.status === "SIGNED";
              return (
                <div key={r.id} className="tbl-row" style={{ gridTemplateColumns: COLS }}>
                  <span style={{ gap: 12 }}>
                    <span className="avatar" aria-hidden="true">{initials(r.name)}</span>
                    <span style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <button className="row-btn ellipsis" type="button" onClick={() => setSel(r.id)} style={{ display: "block", maxWidth: "100%", fontWeight: 700 }}>{r.name}</button>
                      <span className="mono" style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>+91 {r.mobile}</span>
                    </span>
                  </span>
                  <span style={{ gap: 10 }}>
                    <span className="mono" style={{ flex: "none", fontSize: 11.5, fontWeight: 600, padding: "3px 7px", borderRadius: 6, background: "#F1F5F9", color: "#334155" }}>{r.centreCode}</span>
                    <span className="ellipsis" data-tip={r.centreName} style={{ minWidth: 0 }}>{r.centreName}</span>
                  </span>
                  <span><DeliveryPill msgStatus={r.msgStatus} msgStatusAt={r.msgStatusAt} msgError={r.msgError} msgChannel={r.msgChannel} linkSentAt={r.linkSentAt} linkSentVia={r.linkSentVia} /></span>
                  <span><CsrPill status={r.status} /></span>
                  <span style={{ flexDirection: "column", alignItems: "flex-start", justifyContent: "center" }}>
                    {signed ? (
                      <>
                        <span className="mono" style={{ fontSize: 12, color: "#0F172A", whiteSpace: "nowrap" }}>{fmtIST(r.signedAt, false).replace(",", " ·")}</span>
                        {r.geoLat != null && <a className="mono" href={`https://www.google.com/maps?q=${r.geoLat},${r.geoLng}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "#64748B", marginTop: 3, whiteSpace: "nowrap" }}><Icon name="pin" size={12} stroke={2} color="#142844" />{fmtGeo(r.geoLat, r.geoLng)}</a>}
                      </>
                    ) : <span style={{ color: "#94A3B8" }}>—</span>}
                  </span>
                  <span style={{ paddingTop: 8, paddingBottom: 8 }}>
                    {signed && r.impression ? (
                      <button type="button" className="row-btn" onClick={() => setSel(r.id)} aria-label={`Facial impression of ${r.name}`} data-tip={r.liveness === "passed" ? "From the live photo · liveness passed" : "From the live photo"} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Impression grid={r.impression} />
                        {r.liveness === "passed" && <span className="mono" style={{ fontSize: 10, letterSpacing: ".06em", color: "#142844", textTransform: "uppercase" }}>Live</span>}
                      </button>
                    ) : <span style={{ color: "#94A3B8" }}>—</span>}
                  </span>
                  <span style={{ justifyContent: "flex-end", gap: 6 }}>
                    {!signed && <button className="icon-btn icon-btn-ghost" type="button" aria-label="Copy secure link" data-tip="Copy secure link" onClick={() => copy(r)}><Icon name="link" size={16} /></button>}
                    {!signed && data.sms.linkSms && <button className="icon-btn icon-btn-ghost" type="button" aria-label="Send link by SMS" data-tip="Send link by SMS" onClick={() => send([r.id], undefined, "sms")} disabled={!!progress}><Icon name="sms" size={16} /></button>}
                    {!signed && <button className="icon-btn icon-btn-ghost" type="button" aria-label="Send invite on WhatsApp" data-tip="Send invite on WhatsApp" onClick={() => whatsapp(r)} disabled={!!progress}><Icon name="whatsapp" size={16} /></button>}
                    {signed && <a className="icon-btn icon-btn-ghost" aria-label="Download signed PDF" data-tip="Download signed PDF" href={`/api/admin/signatories/${r.id}/file?kind=signed`}><Icon name="download" size={16} /></a>}
                    <button className="icon-btn icon-btn-ink" type="button" aria-label="Open details" data-tip="Open details" onClick={() => setSel(r.id)}><Icon name="next" size={16} /></button>
                  </span>
                </div>
              );
            })}
            {table && rows.length === 0 && (
              <div style={{ padding: "36px 20px", textAlign: "center", color: "#64748B" }}>
                {stats.total ? <>No signatories match. {filtered && <button className="link" type="button" onClick={() => { setCsr(""); setDelivery(""); setQ(""); }}>Clear filters</button>}</> : <>No signatories yet. <Link href={`/admin/exams/${id}/import`}>Import a CSV</Link> or add one by hand.</>}
              </div>
            )}
          </div>
        </div>
        {total > 0 && (
          <div className="mono" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: "1px solid #E2E8F0", fontSize: 11.5, color: "#64748B", background: "#FAFBFC", borderRadius: "0 0 16px 16px" }}>
            <span>{num(page * PAGE + 1)}–{num(Math.min(total, (page + 1) * PAGE))} of {num(total)}{filtered ? ` (filtered from ${num(stats.total)})` : ""}</span>
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

const COLS = "minmax(200px, 1.4fr) minmax(150px, 1.3fr) 150px 120px 158px 104px 132px";
const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function AddSignatory({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: () => void }) {
  const [f, setF] = useState({ name: "", mobile: "", centreCode: "", centreName: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === "mobile" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = [!f.name.trim() && "name", !f.mobile && "mobile", !f.centreCode.trim() && "centre code", !f.centreName.trim() && "centre name"].filter(Boolean);
    if (missing.length) { setErr(`Please fill in the ${missing.join(", ")}.`); return; }
    if (!/^[6-9]\d{9}$/.test(f.mobile)) { setErr("Mobile must be a 10-digit Indian number."); return; }
    setBusy(true); setErr("");
    try { await api(`/api/admin/projects/${projectId}/signatories`, { method: "POST", json: f }); onAdded(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal" noValidate onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }} aria-label="Add signatory">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Kicker delay={0}>Add signatory</Kicker>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}><Icon name="close" size={16} stroke={2} /></button>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>One centre, one signatory</h2>
        <label><span className="label">Signatory name</span><input className="field" autoFocus value={f.name} onChange={set("name")} /></label>
        <label><span className="label">Mobile</span><input className="field" inputMode="numeric" value={f.mobile} onChange={set("mobile")} placeholder="10-digit number" /></label>
        <div style={{ display: "grid", gridTemplateColumns: "120px minmax(0,1fr)", gap: 12 }}>
          <label><span className="label">Centre code</span><input className="field" value={f.centreCode} onChange={set("centreCode")} /></label>
          <label><span className="label">Centre name</span><input className="field" value={f.centreName} onChange={set("centreName")} /></label>
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
      <form className="modal" noValidate onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }} aria-label="Delete exam">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="kicker" style={{ color: "#8C3B1E" }}>Delete exam</div>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose} disabled={busy}><Icon name="close" size={16} stroke={2} /></button>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>Delete “{project.name}” for good?</h2>
        <div style={{ borderRadius: 14, background: "#F7E4DA", color: "#6E3A1C", padding: "14px 16px", fontSize: 14, lineHeight: 1.55 }}>
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
          <button className="btn" type="submit" disabled={!match || busy} style={{ background: "#8C3B1E", color: "#fff" }}>{busy ? <><Spinner /> Deleting…</> : <><Icon name="trash" /> Delete permanently</>}</button>
        </div>
      </form>
    </div>
  );
}
