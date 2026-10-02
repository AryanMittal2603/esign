"use client";

import { useEffect, useState } from "react";
import { Brand, Chip, ErrorBox, Icon, Keypad, Kicker, OtpInput, Spinner, Words, api } from "@/components/ui";
import { fmtIST, type Status } from "@/lib/format";

type Report = { token: string; status: Status; project: string; exam: string | null; date: string | null; shift: string | null; centreCode: string; centreName: string; signedAt: string | null };
type Me = { mobileMasked: string; name: string; reports: Report[] };

/** Direct access without a link: mobile → OTP → the signatory's reports across projects. */
export default function DirectAccess() {
  const [view, setView] = useState<"loading" | "mobile" | "otp" | "list">("loading");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [masked, setMasked] = useState("");

  const loadMe = async () => {
    try { const d = await api<Me>("/api/sign/me"); setMe(d); setView("list"); return true; } catch { return false; }
  };
  useEffect(() => { loadMe().then((ok) => { if (!ok) setView("mobile"); }); }, []);

  const send = async () => {
    setBusy(true); setErr("");
    try {
      const r = await api<{ mobileMasked: string }>("/api/sign/access/send", { method: "POST", json: { mobile } });
      setMasked(r.mobileMasked); setCode(""); setView("otp");
    } catch (e) {
      if ((e as { status?: number }).status === 429) { setView("otp"); }
      setErr((e as Error).message);
    } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setErr("");
    try { await api("/api/sign/access/verify", { method: "POST", json: { mobile, code } }); await loadMe(); }
    catch (e) { setErr((e as Error).message); setCode(""); } finally { setBusy(false); }
  };
  const signOut = async () => { await api("/api/sign/me", { method: "DELETE" }); setMe(null); setMobile(""); setView("mobile"); };

  if (view === "loading") return <div className="stage phone" style={{ display: "grid", placeItems: "center" }}><Spinner /></div>;

  return (
    <div className="stage phone">
      {view === "mobile" && (
        <div className="screen top" key="mobile">
          <div className="curtain" />
          <div className="fade"><Brand size={17} /></div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
            <PhoneArt />
            <Kicker delay={0.4}>No link? No problem.</Kicker>
            <h1 className="h1" style={{ fontSize: 32, lineHeight: 1 }}><Words text="Verify your mobile to find your reports." start={0.5} accent={1} color="#B76A3B" /></h1>
            <p className="sub up" style={{ animationDelay: "1.1s" }}>Use the mobile number the exam office registered for you. Signing opens only after it is verified.</p>
            <label className="up" style={{ animationDelay: "1.25s", display: "block" }}>
              <span className="label">Registered mobile</span>
              <span style={{ display: "flex", gap: 8 }}>
                <span className="field" style={{ width: 72, flex: "none", display: "grid", placeItems: "center", fontWeight: 600 }}>+91</span>
                <input className="field" inputMode="none" autoComplete="tel-national" maxLength={10} placeholder="10-digit number" value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  onKeyDown={(e) => { if (e.key === "Enter" && mobile.length === 10) send(); }}
                  aria-label="Registered mobile number" />
              </span>
            </label>
            <ErrorBox>{err}</ErrorBox>
          </div>
          <Keypad value={mobile} onChange={setMobile} max={10} disabled={busy} />
          <button className="btn btn-ink up" type="button" style={{ animationDelay: "1.45s", width: "100%", minHeight: 54 }} disabled={mobile.length !== 10 || busy} onClick={send}>
            {busy ? <Spinner /> : null} Send OTP
          </button>
          <a className="mono fade" href="/admin/login" style={{ animationDelay: "1.6s", textAlign: "center", fontSize: 11, color: "#637383" }}>Exam office? Admin sign in</a>
        </div>
      )}

      {view === "otp" && (
        <div className="screen top" key="otp">
          <div className="curtain" />
          <button className="icon-btn" type="button" aria-label="Back" onClick={() => { setErr(""); setView("mobile"); }}><Icon name="back" stroke={2} /></button>
          <Kicker style={{ marginTop: 30 }}>Verify</Kicker>
          <h1 className="h1"><Words text="Enter the 6-digit code." /></h1>
          <p className="sub up" style={{ animationDelay: ".8s" }}>Sent by SMS to <b style={{ color: "#142844" }}>+91 {masked || mobile}</b>.</p>
          <div className="up" style={{ animationDelay: ".95s" }}><OtpInput value={code} onChange={setCode} autoFocus /></div>
          <div className="up" style={{ animationDelay: "1.05s" }}><button className="link" type="button" onClick={send} disabled={busy}>Send a new code</button></div>
          <ErrorBox>{err}</ErrorBox>
          <div style={{ flex: 1 }} />
          <Keypad value={code} onChange={setCode} max={6} disabled={busy} />
          <button className="btn btn-ink up" type="button" style={{ animationDelay: "1.15s", width: "100%", minHeight: 54 }} disabled={code.length < 6 || busy} onClick={verify}>
            {busy ? <Spinner /> : null} Verify
          </button>
        </div>
      )}

      {view === "list" && me && (
        <div className="screen top" key="list">
          <div className="curtain" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Brand size={16} animate={false} />
            <span className="chip pop" style={{ animationDelay: ".5s", background: "#E3F0EC", color: "#2E7567" }}>Verified</span>
          </div>
          <Kicker style={{ marginTop: 14 }}>{me.name || `+91 ${me.mobileMasked}`}</Kicker>
          <h1 className="h1"><Words text="Your reports" /></h1>
          <p className="sub up" style={{ animationDelay: ".7s", fontSize: 14 }}>One CSR per exam. Pick the one you need to sign.</p>
          {me.reports.length === 0 && <div className="note">No reports are linked to this number yet.</div>}
          {me.reports.map((r, i) => {
            const signed = r.status === "SIGNED";
            return (
              <div key={r.token} className="card lift up" style={{ animationDelay: `${0.85 + i * 0.12}s`, padding: 18, display: "flex", flexDirection: "column", gap: 12, borderColor: signed ? undefined : "#B76A3B" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  {signed ? <Chip status="SIGNED" /> : <span className="chip" style={{ background: "#F7EDD5", color: "#7E5B12" }}>Waiting for you</span>}
                  {signed && <span className="mono" style={{ fontSize: 11, color: "#637383" }}>Signed {fmtIST(r.signedAt, false)}</span>}
                </div>
                <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: "-0.015em", lineHeight: 1.2 }}>{r.project}</div>
                <div style={{ borderRadius: 12, background: "#F3F6F4", padding: "2px 14px" }}>
                  {r.exam && <div className="kv"><span>Exam</span><span>{r.exam}</span></div>}
                  {(r.date || r.shift) && <div className="kv"><span>Date</span><span>{[r.date, r.shift].filter(Boolean).join(" · ")}</span></div>}
                  <div className="kv"><span>Centre</span><span>{r.centreCode} · {r.centreName}</span></div>
                </div>
                {signed ? (
                  <a className="btn btn-line" href={`/api/sign/${r.token}/signed`} style={{ width: "100%" }}><Icon name="download" /> Download signed PDF</a>
                ) : (
                  <a className="btn btn-ink" href={`/s/${r.token}`} style={{ width: "100%" }}>Continue to sign</a>
                )}
              </div>
            );
          })}
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost fade" type="button" style={{ animationDelay: "1.2s" }} onClick={signOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}

function PhoneArt() {
  return (
    <svg width="60" height="60" viewBox="0 0 84 84" fill="none" aria-hidden="true">
      <rect x="24" y="8" width="36" height="68" rx="8" stroke="#142844" strokeWidth="2.4" pathLength={1} className="draw" style={{ animationDelay: ".3s" }} />
      <path d="M37 66h10" stroke="#142844" strokeWidth="2.4" strokeLinecap="round" pathLength={1} className="draw" style={{ animationDelay: ".9s" }} />
      <circle cx="62" cy="58" r="15" fill="#B76A3B" className="pop" style={{ animationDelay: "1.1s", transformBox: "fill-box", transformOrigin: "center" }} />
      <rect x="56" y="56" width="12" height="9" rx="2" stroke="#FFFFFF" strokeWidth="2" pathLength={1} className="draw" style={{ animationDelay: "1.3s" }} />
      <path d="M58.5 56v-2.5a3.5 3.5 0 0 1 7 0V56" stroke="#FFFFFF" strokeWidth="2" pathLength={1} className="draw" style={{ animationDelay: "1.4s" }} />
    </svg>
  );
}
