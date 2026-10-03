"use client";

import { useEffect, useState } from "react";
import { Brand, ErrorBox, Icon, Keypad, Kicker, OtpInput, Spinner, Words, api } from "@/components/ui";
import { LangButton, SignerApp } from "@/components/sign/Intro";
import { Rosette } from "@/components/sign/Rosette";
import { useI18n } from "@/lib/i18n";
import { fmtIST, type Status } from "@/lib/format";

type Report = { token: string; status: Status; project: string; exam: string | null; date: string | null; shift: string | null; centreCode: string; centreName: string; signedAt: string | null; uploaded: boolean; photo: boolean };
type Me = { mobileMasked: string; name: string; reports: Report[] };

export default function Page() {
  return <SignerApp><DirectAccess /></SignerApp>;
}

/** Direct access without a link: mobile → OTP → the signatory's reports across projects. */
function DirectAccess() {
  const { t, tn } = useI18n();
  const [view, setView] = useState<"loading" | "mobile" | "otp" | "list" | "past">("loading");
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
        <div className="entry" key="mobile">
          <div className="curtain" />
          <header className="entry-hero">
            <Rosette size={460} className="hero-rosette" />
            <div className="entry-top">
              <span className="fade"><Brand size={16} light /></span>
              <span className="fade" style={{ animationDelay: ".2s" }}><LangButton light /></span>
            </div>
            <Kicker delay={0.4}>{t("login.kicker")}</Kicker>
            <h1 className="entry-title"><Words text={t("login.title")} start={0.5} accent={1} color="#E0A27A" /></h1>
            <p className="entry-sub up" style={{ animationDelay: "1s" }}>{t("login.sub")}</p>
          </header>
          <div className="entry-sheet">
            <label className="up" style={{ animationDelay: "1.1s", display: "block" }}>
              <span className="label">{t("login.mobile")}</span>
              <span style={{ display: "flex", gap: 8 }}>
                <span className="field" style={{ width: 72, flex: "none", display: "grid", placeItems: "center", fontWeight: 600 }}>+91</span>
                <input className="field" inputMode="none" autoComplete="tel-national" maxLength={10} placeholder={t("login.placeholder")} value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  onKeyDown={(e) => { if (e.key === "Enter" && mobile.length === 10) send(); }}
                  aria-label={t("login.mobile")} style={{ fontSize: 18, fontWeight: 600, letterSpacing: ".04em" }} />
              </span>
            </label>
            <ErrorBox>{err}</ErrorBox>
            <div style={{ flex: 1 }} />
            <Keypad value={mobile} onChange={setMobile} max={10} disabled={busy} clearLabel={t("keypad.clear")} />
            <button className="btn btn-ink up" type="button" style={{ animationDelay: "1.3s", width: "100%", minHeight: 54 }} disabled={mobile.length !== 10 || busy} onClick={send}>
              {busy ? <Spinner /> : null} {t("common.sendOtp")}
            </button>
            <a className="mono fade" href="/admin/login" style={{ animationDelay: "1.5s", textAlign: "center", fontSize: 11, color: "#637383" }}>{t("login.admin")}</a>
          </div>
        </div>
      )}

      {view === "otp" && (
        <div className="screen top" key="otp">
          <div className="curtain" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button className="icon-btn" type="button" aria-label={t("common.back")} onClick={() => { setErr(""); setView("mobile"); }}><Icon name="back" stroke={2} /></button>
            <LangButton />
          </div>
          <Kicker style={{ marginTop: 30 }}>{t("otp.kicker")}</Kicker>
          <h1 className="h1"><Words text={t("otp.title")} /></h1>
          <p className="sub up" style={{ animationDelay: ".8s" }}>{tn("otp.sentTo", { mobile: <b style={{ color: "#142844" }}>+91 {masked || mobile}</b> })}</p>
          <div className="up" style={{ animationDelay: ".95s" }}><OtpInput value={code} onChange={setCode} autoFocus /></div>
          <div className="up" style={{ animationDelay: "1.05s" }}><button className="link" type="button" onClick={send} disabled={busy}>{t("common.newCode")}</button></div>
          <ErrorBox>{err}</ErrorBox>
          <div style={{ flex: 1 }} />
          <Keypad value={code} onChange={setCode} max={6} disabled={busy} clearLabel={t("keypad.clear")} />
          <button className="btn btn-ink up" type="button" style={{ animationDelay: "1.15s", width: "100%", minHeight: 54 }} disabled={code.length < 6 || busy} onClick={verify}>
            {busy ? <Spinner /> : null} {t("common.verify")}
          </button>
        </div>
      )}

      {(view === "list" || view === "past") && me && (() => {
        const past = me.reports.filter((r) => r.status === "SIGNED");
        const open = me.reports.filter((r) => r.status !== "SIGNED");
        const isPast = view === "past";
        const shown = isPast ? past : open;
        return (
          <div className="screen top" key={view}>
            <div className="curtain" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              {isPast ? (
                <button className="btn btn-line btn-sm" type="button" onClick={() => setView("list")} style={{ paddingLeft: 10 }}><Icon name="back" size={16} stroke={2} /> {t("list.home")}</button>
              ) : <Brand size={16} animate={false} />}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!isPast && (
                  <button className="btn btn-line btn-sm pop" type="button" onClick={() => setView("past")} style={{ animationDelay: ".4s", minHeight: 32, padding: "0 12px", borderRadius: 999, fontSize: 12.5 }}>
                    <Icon name="check" size={14} stroke={2.2} color="#B76A3B" /> {t("list.past")} <span className="mono" style={{ fontSize: 11, color: "#637383" }}>{past.length}</span>
                  </button>
                )}
                <LangButton />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
              <Kicker>{me.name || `+91 ${me.mobileMasked}`}</Kicker>
              <span className="chip pop" style={{ animationDelay: ".5s", background: "#E6ECF4", color: "#1F3A5F", marginLeft: "auto" }}>{t("list.verified")}</span>
            </div>
            <h1 className="h1"><Words text={isPast ? t("list.past") : t("list.yours")} /></h1>
            <p className="sub up" style={{ animationDelay: ".7s", fontSize: 14 }}>{isPast ? t("list.pastSub") : t("list.yoursSub")}</p>

            {shown.length === 0 && (
              <div className="card up" style={{ animationDelay: ".8s", padding: "26px 20px", display: "grid", justifyItems: "center", gap: 10, textAlign: "center" }}>
                {isPast ? (
                  <><div style={{ fontWeight: 800, fontSize: 18 }}>{t("list.nothingSigned")}</div><div style={{ color: "#637383", fontSize: 14 }}>{t("list.nothingSignedSub")}</div></>
                ) : me.reports.length === 0 ? (
                  <><div style={{ fontWeight: 800, fontSize: 18 }}>{t("list.noReports")}</div><div style={{ color: "#637383", fontSize: 14 }}>{t("list.noReportsSub")}</div></>
                ) : (
                  <>
                    <span className="pop" style={{ width: 52, height: 52, borderRadius: "50%", background: "#F5E6DB", display: "grid", placeItems: "center" }}><Icon name="check" size={26} stroke={2.4} color="#B76A3B" /></span>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{t("list.caughtUp")}</div>
                    <div style={{ color: "#637383", fontSize: 14 }}>{t("list.caughtUpSub")}</div>
                    <button className="btn btn-line btn-sm" type="button" onClick={() => setView("past")}>{t("list.viewPast")}</button>
                  </>
                )}
              </div>
            )}

            {shown.map((r, i) => {
              const signed = r.status === "SIGNED";
              return (
                <div key={r.token} className="card lift up" style={{ animationDelay: `${0.85 + i * 0.12}s`, padding: 18, display: "flex", flexDirection: "column", gap: 12, borderColor: signed ? undefined : "#CB8A60" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    {signed ? <span className="chip" style={{ background: "#B76A3B", color: "#fff" }}>{t("status.signed")}</span>
                      : r.photo ? <span className="chip" style={{ background: "#E6ECF4", color: "#1F3A5F" }}>{t("status.photoReady")}</span>
                      : r.uploaded ? <span className="chip" style={{ background: "#E6ECF4", color: "#1F3A5F" }}>{t("status.inProgress")}</span>
                      : <span className="chip" style={{ background: "#F5E6DB", color: "#8C4B26" }}>{t("status.waiting")}</span>}
                    {signed && <span className="mono" style={{ fontSize: 11, color: "#637383" }}>{fmtIST(r.signedAt, false)}</span>}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: "-0.015em", lineHeight: 1.2 }}>{r.project}</div>
                  <div style={{ borderRadius: 12, background: "#F3F6FA", padding: "2px 14px" }}>
                    {r.exam && <div className="kv"><span>{t("kv.exam")}</span><span>{r.exam}</span></div>}
                    {(r.date || r.shift) && <div className="kv"><span>{t("kv.date")}</span><span>{[r.date, r.shift].filter(Boolean).join(" · ")}</span></div>}
                    <div className="kv"><span>{t("kv.centre")}</span><span>{r.centreCode} · {r.centreName}</span></div>
                  </div>
                  {signed ? (
                    <a className="btn btn-line" href={`/api/sign/${r.token}/signed`} style={{ width: "100%" }}><Icon name="download" /> {t("common.downloadSigned")}</a>
                  ) : (
                    <a className="btn btn-ink" href={`/s/${r.token}`} style={{ width: "100%" }}>{r.uploaded ? t("list.continue") : t("list.start")}</a>
                  )}
                </div>
              );
            })}
            <div style={{ flex: 1 }} />
            {isPast ? (
              <button className="btn btn-ink fade" type="button" style={{ animationDelay: "1s", width: "100%", minHeight: 52 }} onClick={() => setView("list")}><Icon name="back" stroke={2} /> {t("list.backHome")}</button>
            ) : (
              <button className="btn btn-ghost fade" type="button" style={{ animationDelay: "1.2s" }} onClick={signOut}>{t("list.signOut")}</button>
            )}
          </div>
        );
      })()}
    </div>
  );
}
