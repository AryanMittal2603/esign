"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brand, ErrorBox, Icon, Kicker, Spinner, Words, api } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const wall = useMemo(() => Array.from({ length: 72 }, (_, i) => {
    const c = i % 24, r = Math.floor(i / 24);
    return { d: (1.4 + (c + r * 0.7) * 0.025).toFixed(3), g: (2.2 + Math.abs(Math.sin(i * 3.7)) * 4).toFixed(2), signed: Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1 < 0.68 };
  }), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api("/api/admin/login", { method: "POST", json: { email, password } });
      router.replace(next && next.startsWith("/admin") ? next : "/admin");
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div className="stage" style={{ minHeight: "100vh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "999 1 560px", minWidth: 0, padding: "clamp(28px, 5vw, 72px)", display: "flex", flexDirection: "column", gap: 28 }}>
        <div className="fade"><Brand size={20} /></div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22, maxWidth: 760 }}>
          <Kicker>CSR eSign · Examination centres</Kicker>
          <h1 style={{ fontSize: "clamp(44px, 6.4vw, 92px)", lineHeight: 0.94, fontWeight: 800, letterSpacing: "-0.045em" }}>
            <Words text="Every centre." start={0.45} step={0.08} /><br />
            <Words text="Every report." start={0.65} step={0.08} /><br />
            <span className="w" style={{ animationDelay: ".9s", color: "#2E7567" }}>Signed.</span>
          </h1>
          <p className="up" style={{ animationDelay: "1.2s", margin: 0, maxWidth: 520, fontSize: 17, lineHeight: 1.55, color: "#637383" }}>
            Onboard signatories, send secure links, and watch each centre&apos;s Satisfactory Report get signed with face and OTP, live on exam day.
          </p>
          <div className="up" style={{ animationDelay: "1.35s", display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(24, minmax(0, 1fr))", gap: 4 }}>
              {wall.map((t, i) => (
                <div key={i} className="tile" style={{ animationDelay: `${t.d}s` }}>
                  <div className={t.signed ? "turn-green" : undefined} style={{ width: "100%", height: "100%", borderRadius: 3, background: "#CBD7DB", animationDelay: `${t.g}s` }} />
                </div>
              ))}
            </div>
            <div className="mono fade" style={{ animationDelay: "2s", display: "flex", alignItems: "center", gap: 8, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#637383" }}>
              <span className="live" /> Centres signing in real time
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: "1 1 400px", minWidth: 0, padding: "clamp(20px, 4vw, 56px)", display: "grid", placeItems: "center" }}>
        <form className="card up" onSubmit={submit} style={{ animationDelay: ".6s", width: "min(100%, 420px)", padding: "36px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Kicker delay={0.8}>Super Admin</Kicker>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em" }}>Sign in</h2>
          </div>
          <label><span className="label">Email</span><input className="field" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@examoffice.gov.in" /></label>
          <label>
            <span className="label">Password</span>
            <span style={{ position: "relative", display: "block" }}>
              <input className="field" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" style={{ paddingRight: 52 }} />
              <button className="icon-btn" type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} style={{ position: "absolute", right: 8, top: 8, border: 0 }}><Icon name="eye" /></button>
            </span>
          </label>
          <ErrorBox>{err}</ErrorBox>
          <button className="btn btn-ink" type="submit" disabled={busy} style={{ width: "100%", minHeight: 52 }}>{busy ? <Spinner /> : null} Sign in</button>
          <div style={{ height: 1, background: "#E6ECEC" }} />
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5, color: "#637383" }}>
            <Icon name="phone" size={20} style={{ marginTop: 1 }} color="#142844" />
            <span>Signing a CSR? Open the link from your SMS, or <a href="/sign">verify your mobile number</a>.</span>
          </div>
        </form>
      </div>
    </div>
  );
}
