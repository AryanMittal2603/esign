"use client";

import { useCallback, useEffect, useState } from "react";
import { Chip, Icon, Kicker, Silhouette, Spinner, api } from "@/components/ui";
import { fmtIST, fmtTimeIST, type Status } from "@/lib/format";
import { DeliveryBadge } from "@/components/admin/Delivery";
import { Confirm } from "@/components/admin/Confirm";

type Detail = {
  id: string; name: string; mobile: string; centreCode: string; centreName: string; status: Status;
  project: { id: string; name: string }; link: string;
  pages: number | null; linkSentAt: string | null; openedAt: string | null; verifiedAt: string | null; uploadedAt: string | null; photoAt: string | null; faceCheck: string | null; geo: { lat: number; lng: number; accuracy: number | null } | null;
  signedAt: string | null; documentId: string | null; otpRef: string | null; signedHash: string | null; device: string | null; signIp: string | null;
  hasPhoto: boolean; hasDraft: boolean; hasSigned: boolean;
  events: { at: string; action: string; text: string; actor: string; ip: string | null }[];
  messages: { channel: string; status: string; error: string | null; at: string; sentAt: string | null; deliveredAt: string | null; readAt: string | null; failedAt: string | null }[];
};

const MILESTONES: { label: string; actions: string[] }[] = [
  { label: "Link sent", actions: ["LINK_SENT"] },
  { label: "Link opened", actions: ["LINK_OPENED"] },
  { label: "Mobile verified", actions: ["OTP_VERIFIED"] },
  { label: "CSR uploaded", actions: ["CSR_UPLOADED", "CSR_REPLACED"] },
  { label: "Live photo + GPS", actions: ["PHOTO_CAPTURED"] },
  { label: "Signed with OTP", actions: ["SIGNED"] },
];

export function SignatoryDrawer({ id, smsReady, waReady, onClose, onChanged, say }: { id: string; smsReady: boolean; waReady?: boolean; onClose: () => void; onChanged: () => void; say: (m: string, bad?: boolean) => void }) {
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
  const sendVia = async (channel: "sms" | "whatsapp") => {
    setBusy(true);
    try { await api(`/api/admin/projects/${d!.project.id}/send`, { method: "POST", json: { ids: [id], channel } }); say(`Link sent on ${channel === "sms" ? "SMS" : "WhatsApp"} to ${d!.name}`); load(); onChanged(); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(false); }
  };
  const sms = () => sendVia("sms");
  const wa = async () => {
    if (waReady) return sendVia("whatsapp");
    try { const r = await api<{ url: string }>(`/api/admin/signatories/${id}/mark-sent`, { method: "POST" }); window.open(r.url, "_blank", "noopener"); load(); onChanged(); }
    catch (e) { say((e as Error).message, true); }
  };
  const [confirmRemove, setConfirmRemove] = useState(false);
  const remove = async () => {
    setBusy(true);
    try { await api(`/api/admin/signatories/${id}`, { method: "DELETE" }); say("Signatory removed"); onChanged(); onClose(); }
    catch (e) { say((e as Error).message, true); setBusy(false); setConfirmRemove(false); }
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
              {(() => {
                const found = MILESTONES.map((m) => [...d.events].reverse().find((e) => m.actions.includes(e.action)));
                // furthest step reached, from the activity log or from the signatory's own status / timestamps
                const fromStatus = d.signedAt ? 5 : d.photoAt ? 4 : d.status === "UPLOADED" ? 3 : d.status === "VERIFIED" ? 2 : d.status === "OPENED" ? 1 : d.linkSentAt ? 0 : -1;
                const lastDone = Math.max(fromStatus, found.reduce((acc, ev, i) => (ev ? i : acc), -1));
                // steps with no record but followed by a later completed step clearly happened
                const implied: Record<string, string> = {
                  "Link sent": "Link shared outside SeqreSign (copied or forwarded)",
                  "Link opened": "Opened from “verify your mobile”",
                  "Mobile verified": "Verified with OTP (time not recorded)",
                };
                const stamps = [d.linkSentAt, d.openedAt, d.verifiedAt, d.uploadedAt, d.photoAt, d.signedAt];
                return MILESTONES.map((m, j) => {
                  const ev = found[j];
                  const ts = ev?.at ?? stamps[j];
                  const done = !!ev || j < lastDone;
                  const next = !done && j === lastDone + 1;
                  return (
                    <div key={m.label} className="up" style={{ animationDelay: `${0.15 + j * 0.06}s`, display: "flex", gap: 14 }}>
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14, flex: "none" }}>
                        <span style={{ width: 12, height: 12, borderRadius: "50%", marginTop: 3, background: done ? (ts ? "#22A06B" : "#fff") : "#fff", border: `2px solid ${done ? "#22A06B" : next ? "#B76A3B" : "#CBD5E1"}` }} />
                        {j < MILESTONES.length - 1 && <span style={{ flex: 1, width: 2, minHeight: 18, background: j < lastDone ? "#22A06B" : "#E2E8F0" }} />}
                      </span>
                      <span style={{ paddingBottom: 14 }}>
                        <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: done || next ? "#0F172A" : "#94A3B8" }}>{m.label}</span>
                        <span className="mono" style={{ display: "block", fontSize: 11.5, color: "#64748B", marginTop: 2 }}>
                          {ts ? `${fmtIST(ts)}${j === 3 && d.pages ? ` · ${d.pages} ${d.pages === 1 ? "page" : "pages"}` : ""}` : done ? implied[m.label] ?? "Done (time not recorded)" : next ? "Waiting" : ""}
                        </span>
                      </span>
                    </div>
                  );
                });
              })()}
            </div>

            {d.messages.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" }}>Invitations</span>
                {d.messages.map((m, i) => (
                  <div key={i} style={{ borderRadius: 12, border: "1px solid #E6ECEC", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6, opacity: i ? 0.7 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <DeliveryBadge status={m.status} channel={m.channel} error={m.error} />
                      <span className="mono" style={{ fontSize: 11, color: "#637383" }}>{fmtIST(m.at, false)}</span>
                    </div>
                    <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", fontSize: 11, color: "#637383" }}>
                      {m.sentAt && <span>Sent {fmtTimeIST(m.sentAt)}</span>}
                      {m.deliveredAt && <span>Delivered {fmtTimeIST(m.deliveredAt)}</span>}
                      {m.readAt && <span style={{ color: "#2557DA" }}>Read {fmtTimeIST(m.readAt)}</span>}
                      {m.status === "failed" && <span style={{ color: "#B23A3A" }}>{m.error ?? "Delivery failed"}</span>}
                      {!m.sentAt && m.status !== "failed" && m.channel === "WHATSAPP" && <span>Waiting for delivery receipt</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

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
                  {smsReady && <button className="btn btn-line" type="button" onClick={sms} disabled={busy}><Icon name="sms" /> {d.status === "IMPORTED" ? "Send SMS" : "Resend SMS"}</button>}
                  <button className="btn btn-ink" type="button" onClick={wa} disabled={busy} style={smsReady ? undefined : { gridColumn: "1 / -1" }}>{busy ? <Spinner /> : <Icon name="whatsapp" />} {d.status === "IMPORTED" ? "Send on WhatsApp" : "Resend on WhatsApp"}</button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button className="link" type="button" onClick={async () => { await navigator.clipboard.writeText(d.link); say("Secure link copied"); }}>Copy secure link</button>
                  <button className="link" type="button" style={{ color: "#B23A3A" }} onClick={() => setConfirmRemove(true)}>Remove</button>
                </div>
              </>
            )}
          </>
        )}
      </aside>
      {confirmRemove && d && (
        <Confirm
          danger
          title={`Remove ${d.name}?`}
          body={<>Centre <b>{d.centreCode}</b> will be removed from this exam and their secure link will stop working. This can&apos;t be undone.</>}
          confirmLabel="Remove signatory"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </>
  );
}
