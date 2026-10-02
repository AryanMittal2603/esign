"use client";

import { useCallback, useEffect, useState } from "react";
import { Chip, Icon, Kicker, Silhouette, Spinner, api } from "@/components/ui";
import { fmtIST, fmtTimeIST, type Status } from "@/lib/format";

type Detail = {
  id: string; name: string; mobile: string; centreCode: string; centreName: string; status: Status;
  project: { id: string; name: string }; link: string;
  pages: number | null; photoAt: string | null; faceCheck: string | null; geo: { lat: number; lng: number; accuracy: number | null } | null;
  signedAt: string | null; documentId: string | null; otpRef: string | null; signedHash: string | null; device: string | null; signIp: string | null;
  hasPhoto: boolean; hasDraft: boolean; hasSigned: boolean;
  events: { at: string; action: string; text: string; actor: string; ip: string | null }[];
};

const MILESTONES: { label: string; actions: string[] }[] = [
  { label: "Link sent", actions: ["LINK_SENT"] },
  { label: "Link opened", actions: ["LINK_OPENED"] },
  { label: "Mobile verified", actions: ["OTP_VERIFIED"] },
  { label: "CSR uploaded", actions: ["CSR_UPLOADED", "CSR_REPLACED"] },
  { label: "Live photo + GPS", actions: ["PHOTO_CAPTURED"] },
  { label: "Signed with OTP", actions: ["SIGNED"] },
];

export function SignatoryDrawer({ id, smsReady, onClose, onChanged, say }: { id: string; smsReady: boolean; onClose: () => void; onChanged: () => void; say: (m: string, bad?: boolean) => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<Detail>(`/api/admin/signatories/${id}`).then(setD).catch((e) => say(e.message, true)), [id, say]);
  useEffect(() => { setD(null); load(); }, [load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const signed = d?.status === "SIGNED";
  const sms = async () => {
    setBusy(true);
    try { await api(`/api/admin/projects/${d!.project.id}/send`, { method: "POST", json: { ids: [id] } }); say(`Link sent by SMS to ${d!.name}`); load(); onChanged(); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(false); }
  };
  const wa = async () => {
    try { const r = await api<{ url: string }>(`/api/admin/signatories/${id}/mark-sent`, { method: "POST" }); window.open(r.url, "_blank", "noopener"); load(); onChanged(); }
    catch (e) { say((e as Error).message, true); }
  };
  const remove = async () => {
    if (!confirm(`Remove ${d!.name} (centre ${d!.centreCode}) from this exam? Their secure link will stop working.`)) return;
    try { await api(`/api/admin/signatories/${id}`, { method: "DELETE" }); say("Signatory removed"); onChanged(); onClose(); }
    catch (e) { say((e as Error).message, true); }
  };

  return (
    <>
      <div className="fade" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "#14284433" }} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-label="Signatory details" style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 51, width: "min(460px, 100%)", background: "#fff", boxShadow: "-30px 0 60px -30px #14284466", padding: 24, display: "flex", flexDirection: "column", gap: 18, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Kicker delay={0}>Centre {d?.centreCode ?? ""}</Kicker>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}><Icon name="close" size={16} stroke={2} /></button>
        </div>
        {!d ? <Spinner /> : (
          <>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span className="pop" style={{ animationDelay: ".1s", width: 76, height: 96, borderRadius: 16, background: "#2A4A78", flex: "none", overflow: "hidden", display: "grid", placeItems: "end center", boxShadow: `0 0 0 3px ${signed ? "#2E7567" : "#D4DEE0"}` }}>
                {d.hasPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/admin/signatories/${id}/file?kind=photo`} alt={`Live photo of ${d.name}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : <Silhouette size={76} />}
              </span>
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{d.name}</span>
                <span className="mono" style={{ fontSize: 12, color: "#637383" }}>+91 {d.mobile}</span>
                <span><Chip status={d.status} /></span>
              </div>
            </div>
            <div style={{ borderRadius: 14, background: "#F3F6F4", padding: "14px 16px", fontSize: 14, lineHeight: 1.45 }}><b>{d.centreName}</b><br /><span style={{ color: "#637383" }}>{d.project.name}</span></div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383", marginBottom: 10 }}>Timeline</span>
              {MILESTONES.map((m, j) => {
                const ev = [...d.events].reverse().find((e) => m.actions.includes(e.action));
                const doneIdx = MILESTONES.reduce((acc, mm, i) => (d.events.some((e) => mm.actions.includes(e.action)) ? i : acc), -1);
                const next = !ev && j === doneIdx + 1;
                return (
                  <div key={m.label} className="up" style={{ animationDelay: `${0.15 + j * 0.06}s`, display: "flex", gap: 14 }}>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14, flex: "none" }}>
                      <span style={{ width: 12, height: 12, borderRadius: "50%", marginTop: 3, background: ev ? "#2E7567" : "#fff", border: `2px solid ${ev ? "#2E7567" : next ? "#B76A3B" : "#D4DEE0"}` }} />
                      {j < MILESTONES.length - 1 && <span style={{ flex: 1, width: 2, minHeight: 18, background: ev && j < doneIdx ? "#2E7567" : "#E6ECEC" }} />}
                    </span>
                    <span style={{ paddingBottom: 14 }}>
                      <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: ev || next ? "#142844" : "#8C99A6" }}>{m.label}</span>
                      <span className="mono" style={{ display: "block", fontSize: 11.5, color: "#637383", marginTop: 2 }}>{ev ? `${fmtIST(ev.at)}${ev.action === "CSR_UPLOADED" || ev.action === "CSR_REPLACED" ? ` · ${d.pages ?? ""} pages` : ""}` : next ? "Waiting" : ""}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            {d.geo && (
              <a href={`https://www.google.com/maps?q=${d.geo.lat},${d.geo.lng}`} target="_blank" rel="noopener noreferrer" style={{ position: "relative", height: 130, borderRadius: 16, overflow: "hidden", backgroundColor: "#E8F1F3", backgroundImage: "linear-gradient(#D4E3E8 1px, transparent 1px), linear-gradient(90deg, #D4E3E8 1px, transparent 1px)", backgroundSize: "22px 22px", display: "block" }} aria-label="Open location in Google Maps">
                <span style={{ position: "absolute", left: 0, right: 0, top: "58%", height: 10, background: "#fff", transform: "rotate(-8deg)" }} />
                <span style={{ position: "absolute", top: 0, bottom: 0, left: "38%", width: 8, background: "#fff", transform: "rotate(14deg)" }} />
                <span style={{ position: "absolute", left: "50%", top: "46%", width: 14, height: 14, margin: "-7px 0 0 -7px", borderRadius: "50%", background: "#2E7567", boxShadow: "0 0 0 4px #fff" }} />
                <span className="live" style={{ position: "absolute", left: "50%", top: "46%", margin: "-4px 0 0 -4px" }} />
                <span className="mono" style={{ position: "absolute", left: 12, bottom: 10, fontSize: 11, background: "#fff", padding: "4px 8px", borderRadius: 8, color: "#142844" }}>{d.geo.lat.toFixed(5)}, {d.geo.lng.toFixed(5)}{d.geo.accuracy ? ` · ±${Math.round(d.geo.accuracy)} m` : ""}</span>
              </a>
            )}

            {signed && (
              <div style={{ borderRadius: 14, border: "1px solid #D4DEE0", padding: "4px 16px" }}>
                <div className="kv"><span>Document ID</span><span className="mono" style={{ fontSize: 12.5 }}>{d.documentId}</span></div>
                <div className="kv"><span>OTP ref</span><span className="mono" style={{ fontSize: 12.5 }}>{d.otpRef}</span></div>
                <div className="kv"><span>Face check</span><span>{d.faceCheck === "passed" ? "Passed" : "Unavailable"}</span></div>
                <div className="kv"><span>Device</span><span style={{ fontSize: 13 }}>{d.device}</span></div>
                <div className="kv"><span>IP</span><span className="mono" style={{ fontSize: 12.5 }}>{d.signIp}</span></div>
              </div>
            )}

            <button className="link" type="button" onClick={() => setShowLog(!showLog)} style={{ alignSelf: "flex-start" }}>{showLog ? "Hide" : "Show"} full audit log ({d.events.length})</button>
            {showLog && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                {d.events.map((e, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "78px minmax(0,1fr)", gap: 10 }}>
                    <span className="mono" style={{ fontSize: 11.5, color: "#637383" }}>{fmtTimeIST(e.at)}</span>
                    <span>{e.text} <span className="mono" style={{ fontSize: 10.5, color: "#8C99A6" }}>· {e.actor.toLowerCase()}{e.ip ? ` · ${e.ip}` : ""}</span></span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ flex: 1 }} />
            {signed ? (
              <a className="btn btn-ink" href={`/api/admin/signatories/${id}/file?kind=signed`} style={{ width: "100%" }}><Icon name="download" /> Download signed PDF</a>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10 }}>
                  <button className="btn btn-line" type="button" onClick={wa}><Icon name="whatsapp" /> WhatsApp</button>
                  <button className="btn btn-ink" type="button" onClick={sms} disabled={!smsReady || busy}>{busy ? <Spinner /> : <Icon name="sms" />} {d.status === "IMPORTED" ? "Send SMS" : "Resend SMS"}</button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button className="link" type="button" onClick={async () => { await navigator.clipboard.writeText(d.link); say("Secure link copied"); }}>Copy secure link</button>
                  <button className="link" type="button" style={{ color: "#B23A3A" }} onClick={remove}>Remove</button>
                </div>
              </>
            )}
          </>
        )}
      </aside>
    </>
  );
}
