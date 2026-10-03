"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Brand, ErrorBox, Icon, Keypad, Kicker, OtpInput, Seal, Spinner, Words, api } from "@/components/ui";
import { FaceCamera, getPosition, type CameraHandle, type FaceState, type Geo } from "./FaceCamera";
import { PdfPreview } from "./PdfPreview";
import { toJpeg, uploadToBlob, uploadWithProgress } from "./media";
import { fmtBytes, fmtIST, fmtTimeIST } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { LangButton } from "./Intro";
import { Rosette } from "./Rosette";

type Data = {
  authorised: boolean;
  project: { name: string; exam: string | null; date: string | null; shift: string | null };
  centreCode: string;
  mobileMasked: string;
  stage: "signed" | "uploaded" | "new";
  signedOn: string | null;
  name?: string;
  centreName?: string;
  status?: string;
  draft?: { pages: number; size: number; uploadedAt: string } | null;
  photo?: { at: string; lat: number; lng: number; accuracy: number | null; face: string; liveness?: string | null } | null;
  consentAt?: string | null;
  signed?: { at: string; documentId: string; pages: number } | null;
  directUpload?: { prefix: string } | null;
};

type Step = "link" | "otp" | "details" | "upload" | "preview" | "photo" | "consent" | "signotp" | "done";
const BAR: Step[] = ["otp", "details", "upload", "preview", "photo", "consent", "signotp"];

type Pending = { id: number; blob: Blob; type: string; name: string; thumb?: string };

export function SignFlow({ token }: { token: string }) {
  const { t, tn, plural } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [step, setStep] = useState<Step>("link");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      const d = await api<Data>(`/api/sign/${token}`);
      setData(d);
      return d;
    } catch (e) {
      if ((e as { status?: number }).status === 404) setInvalid(true);
      else setErr((e as Error).message);
      return null;
    }
  }, [token]);

  useEffect(() => {
    load().then((d) => {
      if (!d) return;
      if (d.signed) setStep("done");
      else if (d.authorised) setStep("details");
    });
  }, [load]);

  // resend countdown
  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [resendAt]);
  const resendIn = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));

  const go = (s: Step) => { setErr(""); setCode(""); setStep(s); window.scrollTo({ top: 0 }); };

  /* ── access OTP ── */
  const sendAccess = async () => {
    setBusy(true); setErr("");
    try {
      const r = await api<{ resendIn: number }>("/api/sign/access/send", { method: "POST", json: { token } });
      setResendAt(Date.now() + r.resendIn * 1000);
      go("otp");
    } catch (e) {
      const d = (e as { data?: { resendIn?: number } }).data;
      if (d?.resendIn) { setResendAt(Date.now() + d.resendIn * 1000); go("otp"); }
      else setErr((e as Error).message);
    } finally { setBusy(false); }
  };
  const verifyAccess = async () => {
    setBusy(true); setErr("");
    try {
      await api("/api/sign/access/verify", { method: "POST", json: { token, code } });
      const d = await load();
      go(d?.signed ? "done" : "details");
    } catch (e) { setErr((e as Error).message); setCode(""); } finally { setBusy(false); }
  };

  if (invalid) return <InvalidLink />;
  if (!data) {
    return (
      <div className="stage phone" style={{ display: "grid", placeItems: "center" }}>
        {err ? <ErrorBox>{err}</ErrorBox> : <Spinner />}
      </div>
    );
  }

  const stepNo = BAR.indexOf(step) + 1;
  const back: Partial<Record<Step, Step>> = { otp: "link", upload: "details", preview: "upload", photo: "preview", consent: "photo", signotp: "consent" };

  return (
    <div className="stage phone">
      {stepNo > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, zIndex: 30, padding: "18px 20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {back[step] ? (
              <button className="icon-btn" type="button" aria-label={t("common.back")} onClick={() => go(back[step]!)}><Icon name="back" stroke={2} /></button>
            ) : <span style={{ width: 34 }} />}
            <Brand size={15} animate={false} />
            <span className="mono" style={{ fontSize: 11, letterSpacing: ".08em", color: "#637383", width: 34, textAlign: "right" }}>{stepNo}/7</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {BAR.map((s, i) => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i + 1 < stepNo ? "#142844" : i + 1 === stepNo ? "#B76A3B" : "#D4DEE0", transition: "background-color .6s ease" }} />
            ))}
          </div>
        </div>
      )}

      {step === "link" && (
        <div className="entry" key="link">
          <div className="curtain" />
          <header className="entry-hero">
            <Rosette size={460} className="hero-rosette" />
            <div className="entry-top">
              <span className="fade"><Brand size={16} /></span>
              <span className="fade" style={{ animationDelay: ".2s" }}><LangButton /></span>
            </div>
            <Kicker delay={0.4}>{t("link.kicker", { code: data.centreCode })}</Kicker>
            <h1 className="entry-title">
              <Words key={`${data.stage}-${t("link.newTitle")}`} text={data.stage === "signed" ? t("link.signedTitle") : data.stage === "uploaded" ? t("link.uploadedTitle") : t("link.newTitle")} start={0.5} accent={1} color="#B76A3B" />
            </h1>
            <p className="entry-sub up" style={{ animationDelay: "1s" }}>
              {data.stage === "signed" ? tn("link.signedSub", { date: <b style={{ color: "#142844" }}>{fmtIST(data.signedOn)}</b> }) : data.stage === "uploaded" ? t("link.uploadedSub") : t("link.newSub")}
            </p>
          </header>
          <div className="entry-sheet">
            <div className="card up" style={{ animationDelay: "1.1s", padding: "4px 16px", position: "relative" }}>
              {data.stage === "signed" && <span className="pop" style={{ position: "absolute", right: -8, top: -12, width: 34, height: 34, borderRadius: "50%", background: "#B76A3B", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 8px 18px -8px #B76A3B", animationDelay: "1.4s" }}><Icon name="check" size={18} stroke={2.6} /></span>}
              <div className="kv"><span>{t("kv.exam")}</span><span>{data.project.exam ?? data.project.name}</span></div>
              {(data.project.date || data.project.shift) && <div className="kv"><span>{t("kv.shift")}</span><span>{[data.project.date, data.project.shift].filter(Boolean).join(" · ")}</span></div>}
              <div className="kv"><span>{t("kv.mobile")}</span><span>+91 {data.mobileMasked}</span></div>
            </div>
            <div style={{ flex: 1 }} />
            <ErrorBox>{err}</ErrorBox>
            <button className={`btn ${data.stage === "signed" ? "btn-line" : "btn-ink"} up`} type="button" style={{ animationDelay: "1.3s", width: "100%", minHeight: 54 }} onClick={sendAccess} disabled={busy}>
              {busy ? <Spinner /> : data.stage === "signed" ? <Icon name="download" /> : null} {data.stage === "signed" ? t("link.verifyDownload") : t("common.sendOtp")}
            </button>
            <div className="mono fade" style={{ animationDelay: "1.5s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, color: "#637383" }}>
              <Icon name="lock" size={13} stroke={2} /> {t("link.lock")}
            </div>
          </div>
        </div>
      )}

      {step === "otp" && (
        <div className="screen" key="otp">
          <div className="curtain" />
          <Kicker>{t("step", { n: 1, name: t("step.verify") })}</Kicker>
          <h1 className="h1"><Words key={t("verify.title")} text={t("verify.title")} /></h1>
          <p className="sub up" style={{ animationDelay: ".9s" }}>{tn("verify.sub", { mobile: <b style={{ color: "#142844" }}>+91 {data.mobileMasked}</b> })}</p>
          <div className="up" style={{ animationDelay: "1s", marginTop: 6 }}><OtpInput value={code} onChange={setCode} autoFocus /></div>
          <div className="up" style={{ animationDelay: "1.1s", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {resendIn > 0 ? <span className="mono" style={{ fontSize: 12, color: "#637383" }}>{t("common.resendIn", { s: `0:${String(resendIn).padStart(2, "0")}` })}</span> : <button className="link" type="button" onClick={sendAccess} disabled={busy}>{t("common.newCode")}</button>}
          </div>
          <ErrorBox>{err}</ErrorBox>
          <div style={{ flex: 1 }} />
          <Keypad value={code} onChange={setCode} max={6} disabled={busy} clearLabel={t("keypad.clear")} />
          <button className="btn btn-ink up" type="button" style={{ animationDelay: "1.2s", width: "100%", minHeight: 54 }} disabled={code.length < 6 || busy} onClick={verifyAccess}>
            {busy ? <Spinner /> : null} {t("verify.cta")}
          </button>
        </div>
      )}

      {step === "details" && (
        <div className="screen" key="details">
          <div className="curtain" />
          <Kicker>{t("step", { n: 2, name: t("step.details") })}</Kicker>
          <h1 className="h1"><Words key={t("details.title")} text={t("details.title")} accent={1} color="#B76A3B" /></h1>
          <div className="card up" style={{ animationDelay: ".75s", padding: "4px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid #E6ECEC" }}>
              <div className="pop" style={{ animationDelay: "1s", width: 44, height: 44, borderRadius: "50%", background: "#E6ECF4", color: "#1F3A5F", display: "grid", placeItems: "center", fontWeight: 800 }}>{initials(data.name)}</div>
              <div><div style={{ fontWeight: 700, fontSize: 17 }}>{data.name}</div><div className="mono" style={{ fontSize: 12, color: "#637383", marginTop: 3 }}>+91 {data.mobileMasked}</div></div>
            </div>
            <div className="kv"><span>{t("kv.centreCode")}</span><span>{data.centreCode}</span></div>
            <div className="kv"><span>{t("kv.centre")}</span><span>{data.centreName}</span></div>
            <div className="kv"><span>{t("kv.exam")}</span><span>{data.project.exam ?? data.project.name}{data.project.date || data.project.shift ? <><br />{[data.project.date, data.project.shift].filter(Boolean).join(" · ")}</> : null}</span></div>
          </div>
          <div className="note up" style={{ animationDelay: ".95s" }}>
            <Icon name="info" style={{ marginTop: 1 }} />
            {t("details.note")}
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ink up" type="button" style={{ animationDelay: "1.1s", width: "100%", minHeight: 54 }} onClick={() => go("upload")}>{t("details.cta")}</button>
        </div>
      )}

      {step === "upload" && <UploadStep key="upload" token={token} data={data} onDone={async () => { await load(); go("preview"); }} />}

      {step === "preview" && data.draft && (
        <div className="screen" key="preview" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="curtain" />
          <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            <Kicker>{t("step", { n: 4, name: t("step.review") })}</Kicker>
            <h1 className="h1"><Words key={t("review.title")} text={t("review.title")} /></h1>
            <p className="sub up" style={{ animationDelay: ".7s" }}>{t("review.sub")}</p>
          </div>
          <PdfPreview url={`/api/sign/${token}/document?v=${encodeURIComponent(data.draft.uploadedAt)}`} />
          <div className="mono up" style={{ animationDelay: "1s", padding: "0 24px", fontSize: 12, color: "#637383" }}>
            {t("review.meta", { pages: plural("pages", data.draft.pages), size: fmtBytes(data.draft.size) })}
          </div>
          <div style={{ flex: 1 }} />
          <div className="up" style={{ animationDelay: "1.1s", padding: "0 24px", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 10 }}>
            <button className="btn btn-line" type="button" style={{ minHeight: 54 }} onClick={() => go("upload")}>{t("review.replace")}</button>
            <button className="btn btn-ink" type="button" style={{ minHeight: 54 }} onClick={() => go("photo")}>{t("review.ok")}</button>
          </div>
        </div>
      )}

      {step === "photo" && <PhotoStep key="photo" token={token} data={data} onDone={async () => { await load(); go("consent"); }} />}

      {step === "consent" && <ConsentStep key="consent" token={token} data={data} onSent={(s) => { setResendAt(Date.now() + s * 1000); go("signotp"); }} />}

      {step === "signotp" && (
        <SignOtpStep
          key="signotp"
          token={token}
          data={data}
          resendIn={resendIn}
          onResent={(s) => setResendAt(Date.now() + s * 1000)}
          onSigned={async () => { await load(); go("done"); }}
        />
      )}

      {step === "done" && data.signed && <DoneStep key="done" token={token} data={data} />}
    </div>
  );
}

/* ───────────────────────── upload ───────────────────────── */

function UploadStep({ token, data, onDone }: { token: string; data: Data; onDone: () => Promise<void> }) {
  const { t, plural } = useI18n();
  const [pending, setPending] = useState<Pending[]>([]);
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const camInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => () => pending.forEach((p) => p.thumb && URL.revokeObjectURL(p.thumb)), [pending]);

  const add = async (files: FileList | null, fromCamera: boolean) => {
    if (!files?.length) return;
    setErr("");
    const next: Pending[] = [];
    for (const f of Array.from(files)) {
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (isPdf) { next.push({ id: ++seq.current, blob: f, type: "application/pdf", name: f.name }); continue; }
      if (!f.type.startsWith("image/") && !/\.(jpe?g|png|heic|heif)$/i.test(f.name)) { setErr(t("upload.badType", { name: f.name })); continue; }
      try {
        const jpg = await toJpeg(f);
        next.push({ id: ++seq.current, blob: jpg, type: "image/jpeg", name: f.name || (fromCamera ? "scan.jpg" : "image.jpg"), thumb: URL.createObjectURL(jpg) });
      } catch (e) { setErr((e as Error).message); }
    }
    setPending((p) => [...p, ...next]);
  };

  const submit = async () => {
    if (!pending.length) { await onDone(); return; }
    setErr(""); setProgress(0);
    const names = pending.map((p, i) => (p.type === "application/pdf" ? p.name : `page-${i + 1}.jpg`));
    try {
      if (data.directUpload) {
        // Straight to private Blob storage, then the server merges and encrypts.
        const parts = await uploadToBlob(token, data.directUpload.prefix, pending.map((p, i) => ({ blob: p.blob, type: p.type, name: names[i] })), setProgress);
        await api(`/api/sign/${token}/upload`, { method: "POST", json: { parts } });
      } else {
        const form = new FormData();
        pending.forEach((p, i) => form.append("files", p.blob, names[i]));
        await uploadWithProgress(`/api/sign/${token}/upload`, form, setProgress);
      }
      setPending([]);
      await onDone();
    } catch (e) { setErr((e as Error).message); } finally { setProgress(null); }
  };

  const remove = (id: number) => setPending((p) => p.filter((x) => x.id !== id));
  const count = pending.length;

  return (
    <div className="screen">
      <div className="curtain" />
      <Kicker>{t("step", { n: 3, name: t("step.upload") })}</Kicker>
      <h1 className="h1"><Words key={t("upload.title")} text={t("upload.title")} /></h1>
      <p className="sub up" style={{ animationDelay: ".7s", fontSize: 14 }}>{t("upload.sub")}</p>
      <input ref={camInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files, true); e.target.value = ""; }} />
      <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png" multiple hidden onChange={(e) => { add(e.target.files, false); e.target.value = ""; }} />
      <div className="up" style={{ animationDelay: ".85s", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
        <button className="card lift" type="button" onClick={() => camInput.current?.click()} style={tileBtn}>
          <span style={{ ...tileIcon, background: "#142844" }}><Icon name="camera" color="#fff" size={20} /></span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{count ? t("upload.scanNext") : t("upload.scan")}</span>
          <span className="mono" style={{ fontSize: 11, color: "#637383" }}>{t("upload.camera")}</span>
        </button>
        <button className="card lift" type="button" onClick={() => fileInput.current?.click()} style={tileBtn}>
          <span style={{ ...tileIcon, background: "#F5E6DB", color: "#8C4B26" }}><Icon name="upload" size={20} /></span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t("upload.file")}</span>
          <span className="mono" style={{ fontSize: 11, color: "#637383" }}>PDF · JPG · PNG</span>
        </button>
      </div>

      <div className="up" style={{ animationDelay: "1s", position: "relative", flex: 1, minHeight: 220, borderRadius: 18, border: "1.5px dashed #A8BBC2", background: "#FFFFFF80" }}>
        {count === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: 20 }}>
            {data.draft ? (
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{t("upload.already", { pages: plural("pages", data.draft.pages) })}</div>
                <div className="mono" style={{ fontSize: 11, color: "#637383", marginTop: 6 }}>{t("upload.replaceHint")}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{t("upload.stack")}</div>
                <div className="mono" style={{ fontSize: 11, color: "#637383", marginTop: 6 }}>{t("upload.noLimit")}</div>
              </div>
            )}
          </div>
        )}
        {pending.map((p, n) => (
          <div key={p.id} style={{ position: "absolute", left: "50%", top: "46%", width: 124, height: 164, margin: "-82px 0 0 -62px", transform: `translate(${(Math.sin(n * 1.7) * 14).toFixed(1)}px, ${-n * 7}px) rotate(${(Math.sin(n * 2.3) * 5).toFixed(1)}deg)`, zIndex: n }}>
            <div className="drop" style={{ width: "100%", height: "100%", borderRadius: 6, background: "#fff", border: "1px solid #D4DEE0", boxShadow: "0 14px 24px -16px #14284466", overflow: "hidden", position: "relative" }}>
              {p.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumb} alt={`Page ${n + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ height: "100%", display: "grid", placeItems: "center", padding: 10, textAlign: "center" }}>
                  <div><div style={{ font: "700 13px var(--font-mono)", color: "#A65B30" }}>PDF</div><div className="mono" style={{ fontSize: 10, color: "#637383", marginTop: 6, wordBreak: "break-all" }}>{p.name}</div></div>
                </div>
              )}
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => remove(p.id)} style={{ position: "absolute", right: 4, top: 4, width: 26, height: 26, borderRadius: 8, border: 0, background: "#142844CC", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
                <Icon name="close" size={14} stroke={2.2} />
              </button>
            </div>
          </div>
        ))}
        {count > 0 && (
          <div style={{ position: "absolute", left: 12, right: 12, bottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 20 }}>
            <span className="chip pop" style={{ background: "#F5E6DB", color: "#8C4B26" }}>{plural(pending.some((x) => x.type === "application/pdf") ? "files" : "pages", count)}</span>
            <button className="btn btn-ink btn-sm pop" type="button" onClick={() => camInput.current?.click()} style={{ animationDelay: ".15s", minHeight: 36, padding: "0 14px", borderRadius: 999 }}>
              <Icon name="plus" size={16} stroke={2.2} /> {t("upload.addPage")}
            </button>
            <button className="link" type="button" style={{ fontSize: 13 }} onClick={() => setPending([])}>{t("upload.startOver")}</button>
          </div>
        )}
      </div>
      <ErrorBox>{err}</ErrorBox>
      {progress !== null && (
        <div style={{ height: 6, borderRadius: 3, background: "#E6ECEC", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: "#142844", transition: "width .2s" }} />
        </div>
      )}
      <button className="btn btn-ink up" type="button" style={{ animationDelay: "1.1s", width: "100%", minHeight: 54 }} disabled={(!count && !data.draft) || progress !== null} onClick={submit}>
        {progress !== null ? <><Spinner /> {progress < 1 ? t("upload.uploading", { pct: Math.round(progress * 100) }) : t("upload.merging")}</> : t("upload.cta")}
      </button>
    </div>
  );
}

const tileBtn: React.CSSProperties = { padding: "16px 14px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit" };
const tileIcon: React.CSSProperties = { width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center" };

/* ───────────────────────── photo ───────────────────────── */

function PhotoStep({ token, data, onDone }: { token: string; data: Data; onDone: () => Promise<void> }) {
  const { t } = useI18n();
  const cam = useRef<CameraHandle>(null);
  const [face, setFace] = useState<FaceState>("starting");
  const [camErr, setCamErr] = useState("");
  const [camKey, setCamKey] = useState(0);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoErr, setGeoErr] = useState("");
  const [shot, setShot] = useState<string | null>(data.photo ? `/api/sign/${token}/photo?v=${encodeURIComponent(data.photo.at)}` : null);
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const locate = useCallback(() => {
    setGeoErr("");
    getPosition().then(setGeo).catch((e) => setGeoErr(e.message));
  }, []);
  useEffect(() => { if (!shot) locate(); }, [shot, locate]);

  const live = face === "passed";
  const canCapture = !!geo && (live || face === "unavailable") && !camErr;
  const stepIdx = face === "blink" ? 1 : face === "turn" || face === "center" ? 2 : live ? 3 : 0;

  const capture = async () => {
    if (!cam.current || !geo) return;
    setBusy(true); setErr("");
    try {
      const blob = await cam.current.capture();
      const form = new FormData();
      form.append("photo", blob, "photo.jpg");
      form.append("lat", String(geo.lat));
      form.append("lng", String(geo.lng));
      form.append("accuracy", String(geo.accuracy));
      form.append("face", live ? "passed" : "unavailable");
      form.append("liveness", live ? "passed" : "unavailable");
      await uploadWithProgress(`/api/sign/${token}/photo`, form, () => {});
      setShot(URL.createObjectURL(blob));
      setFresh(true);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const prompt = (f: FaceState) => t(`face.${f}` as Parameters<typeof t>[0]);
  const badge = camErr ? null : (
    <span key={face} className="chip pop" style={live ? chipDark("#B76A3B", "#FFFFFF") : face === "many" ? chipDark("#F5E6DB", "#8C4B26") : chipDark("#FFFFFFE6", "#142844")}>
      {prompt(face)}
    </span>
  );

  return (
    <div className="screen">
      <div className="curtain" />
      <Kicker>{t("step", { n: 5, name: t("step.photo") })}</Kicker>
      <h1 className="h1"><Words key={t("photo.title")} text={t("photo.title")} accent={1} color="#B76A3B" /></h1>
      <div className="viewfinder up" style={{ animationDelay: ".8s" }}>
        {shot ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot} alt="Your captured photo" />
            <div style={{ position: "absolute", inset: 0, border: "4px solid #CB8A60", borderRadius: 24 }} />
            {fresh && <div className="flash" style={{ position: "absolute", inset: 0, background: "#fff" }} />}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 16, display: "grid", placeItems: "center" }}>
              <span className="chip pop" style={{ animationDelay: ".3s", height: 30, background: "#B76A3B", color: "#fff" }}>{t("photo.captured", { time: fmtTimeIST(fresh ? new Date() : data.photo?.at) })}</span>
            </div>
          </>
        ) : (
          <>
            <FaceCamera key={camKey} ref={cam} onFace={setFace} onError={setCamErr} />
            <svg viewBox="0 0 342 388" fill="none" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="none">
              <ellipse cx="171" cy="184" rx="104" ry="138" stroke={live ? "#CB8A60" : stepIdx > 0 ? "#EBCDB8" : "#FFFFFF"} strokeOpacity={live || stepIdx > 0 ? 1 : 0.6} strokeWidth={live ? 3.5 : stepIdx > 0 ? 3 : 2} pathLength={1} className="draw" style={{ animationDelay: "1s", transition: "stroke .3s" }} />
            </svg>
            {camErr && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, color: "#fff", textAlign: "center", fontSize: 14, lineHeight: 1.5 }}>
                {camErr}
                <button className="btn btn-line btn-sm" type="button" onClick={() => { setCamErr(""); setFace("starting"); setCamKey((k) => k + 1); }}>{t("photo.tryAgain")}</button>
              </div>
            )}
            {!camErr && face !== "unavailable" && (
              <div style={{ position: "absolute", top: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }} aria-label="Liveness steps">
                {[t("photo.chipFace"), t("photo.chipBlink"), t("photo.chipTurn")].map((l, i) => {
                  const done = stepIdx > i;
                  const cur = stepIdx === i && face !== "none" && face !== "many" && face !== "starting" && face !== "loading";
                  return (
                    <span key={l} className="chip" style={{ height: 24, background: done ? "#B76A3B" : cur ? "#FFFFFF" : "#FFFFFF33", color: done ? "#fff" : cur ? "#142844" : "#FFFFFFCC", transition: "background-color .3s, color .3s" }}>
                      {done ? "✓ " : ""}{l}
                    </span>
                  );
                })}
              </div>
            )}
            <div style={{ position: "absolute", left: 12, right: 12, bottom: 16, display: "grid", placeItems: "center", textAlign: "center" }}>{badge}</div>
          </>
        )}
      </div>

      <div className="card pop" style={{ animationDelay: "1.2s", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 14 }}>
        <span style={{ width: 30, height: 30, borderRadius: "50%", background: geo || shot ? "#F5E6DB" : "#E6ECF4", display: "grid", placeItems: "center", flex: "none" }}>
          <Icon name="pin" size={16} stroke={2} color={geo || shot ? "#A65B30" : "#4A6A94"} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {shot && data.photo && !geo ? (
            <><div style={{ fontWeight: 700, fontSize: 13 }}>{t("geo.captured")}</div><div className="mono" style={{ fontSize: 11, color: "#637383", marginTop: 2 }}>{data.photo.lat.toFixed(4)}° N, {data.photo.lng.toFixed(4)}° E</div></>
          ) : geo ? (
            <><div style={{ fontWeight: 700, fontSize: 13 }}>{t("geo.captured")}</div><div className="mono" style={{ fontSize: 11, color: "#637383", marginTop: 2 }}>{geo.lat.toFixed(4)}° N, {geo.lng.toFixed(4)}° E · ±{Math.round(geo.accuracy)} m</div></>
          ) : geoErr ? (
            <><div style={{ fontWeight: 700, fontSize: 13 }}>{t("geo.needed")}</div><div style={{ fontSize: 12, color: "#637383", marginTop: 2 }}>{geoErr}</div></>
          ) : (
            <><div style={{ fontWeight: 700, fontSize: 13 }}>{t("geo.finding")}</div><div className="mono" style={{ fontSize: 11, color: "#637383", marginTop: 2 }}>{t("geo.allow")}</div></>
          )}
        </div>
        {geoErr && !shot && <button className="btn btn-line btn-sm" type="button" onClick={locate}>{t("geo.retry")}</button>}
      </div>

      <ErrorBox>{err}</ErrorBox>
      <div style={{ flex: 1 }} />
      {shot ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 10 }}>
          <button className="btn btn-line" type="button" style={{ minHeight: 54 }} onClick={() => { setShot(null); setFresh(false); setFace("starting"); }}>{t("photo.retake")}</button>
          <button className="btn btn-ink" type="button" style={{ minHeight: 54 }} onClick={onDone}>{t("photo.use")}</button>
        </div>
      ) : (
        <>
          <button className="btn btn-ink up" type="button" style={{ animationDelay: "1.1s", width: "100%", minHeight: 54 }} disabled={!canCapture || busy} onClick={capture}>
            {busy ? <Spinner /> : <Icon name="camera" />} {t("photo.capture")}
          </button>
          <div className="mono" style={{ fontSize: 11, color: "#637383", textAlign: "center" }}>{t("photo.liveOnly")}</div>
        </>
      )}
    </div>
  );
}

const chipDark = (bg: string, fg: string): React.CSSProperties => ({ height: 30, background: bg, color: fg });

/* ───────────────────────── consent ───────────────────────── */

function ConsentStep({ token, data, onSent }: { token: string; data: Data; onSent: (resendIn: number) => void }) {
  const { t, plural } = useI18n();
  const [a1, setA1] = useState(false);
  const [a2, setA2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pages = data.draft?.pages ?? 0;

  const next = async () => {
    setBusy(true); setErr("");
    try {
      const r = await api<{ resendIn: number }>(`/api/sign/${token}/sign-otp`, { method: "POST", json: { consent: true } });
      onSent(r.resendIn);
    } catch (e) {
      const d = (e as { data?: { resendIn?: number } }).data;
      if (d?.resendIn) onSent(d.resendIn); else setErr((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <div className="curtain" />
      <Kicker>{t("step", { n: 6, name: t("step.consent") })}</Kicker>
      <h1 className="h1"><Words key={t("consent.title")} text={t("consent.title")} /></h1>
      <div className="card up" style={{ animationDelay: ".7s", padding: "4px 16px" }}>
        <SummaryRow
          icon={<span style={{ width: 38, height: 46, borderRadius: 5, border: "1px solid #D4DEE0", background: "#fff", display: "grid", placeItems: "center" }}><span style={{ width: 20, height: 3, borderRadius: 2, background: "#142844" }} /></span>}
          title={t("consent.csr", { pages: plural("pages", pages) })} sub={t("consent.merged", { size: fmtBytes(data.draft?.size) })} delay={1}
        />
        <SummaryRow
          icon={
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/sign/${token}/photo?v=${encodeURIComponent(data.photo?.at ?? "")}`} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", background: "#2A4A78" }} />
          }
          title={t("consent.photo")} sub={`${data.photo?.liveness === "passed" ? t("consent.liveness") : data.photo?.face === "passed" ? t("consent.face") : t("consent.camera")} · ${fmtTimeIST(data.photo?.at)}`} delay={1.1}
        />
        <SummaryRow
          icon={<span style={{ width: 38, height: 38, borderRadius: "50%", background: "#F5E6DB", display: "grid", placeItems: "center" }}><Icon name="pin" size={17} stroke={2} color="#A65B30" /></span>}
          title={t("consent.centre", { code: data.centreCode })} sub={data.photo ? `${data.photo.lat.toFixed(4)}° N, ${data.photo.lng.toFixed(4)}° E` : ""} delay={1.2} last
        />
      </div>
      <div className="up" style={{ animationDelay: ".95s", display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
        <label style={{ display: "flex", gap: 12, fontSize: 14, lineHeight: 1.45, cursor: "pointer" }}>
          <input className="check" type="checkbox" checked={a1} onChange={(e) => setA1(e.target.checked)} />
          <span>{t("consent.a1")}</span>
        </label>
        <label style={{ display: "flex", gap: 12, fontSize: 14, lineHeight: 1.45, cursor: "pointer" }}>
          <input className="check" type="checkbox" checked={a2} onChange={(e) => setA2(e.target.checked)} />
          <span>{t("consent.a2")}</span>
        </label>
      </div>
      <ErrorBox>{err}</ErrorBox>
      <div style={{ flex: 1 }} />
      <button className="btn btn-ink up" type="button" style={{ animationDelay: "1.1s", width: "100%", minHeight: 54 }} disabled={!(a1 && a2) || busy} onClick={next}>
        {busy ? <Spinner /> : null} {t("consent.cta")}
      </button>
    </div>
  );
}

function SummaryRow({ icon, title, sub, delay, last }: { icon: React.ReactNode; title: string; sub: string; delay: number; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: last ? 0 : "1px solid #E6ECEC" }}>
      <span style={{ flex: "none" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div><div className="mono ellipsis" style={{ fontSize: 11, color: "#637383", marginTop: 2 }}>{sub}</div></div>
      <span className="pop" style={{ animationDelay: `${delay}s` }}><Icon name="check" color="#B76A3B" stroke={2.4} /></span>
    </div>
  );
}

/* ───────────────────────── sign OTP ───────────────────────── */

function SignOtpStep({ token, data, resendIn, onResent, onSigned }: { token: string; data: Data; resendIn: number; onResent: (s: number) => void; onSigned: () => Promise<void> }) {
  const { t, tn, plural } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pages = data.draft?.pages ?? 0;

  const resend = async () => {
    setErr("");
    try {
      const r = await api<{ resendIn: number }>(`/api/sign/${token}/sign-otp`, { method: "POST", json: { consent: true } });
      onResent(r.resendIn);
    } catch (e) { setErr((e as Error).message); }
  };
  const sign = async () => {
    setBusy(true); setErr("");
    try {
      await api(`/api/sign/${token}/sign`, { method: "POST", json: { code } });
      await onSigned();
    } catch (e) { setErr((e as Error).message); setCode(""); } finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <div className="curtain" />
      <Kicker>{t("step", { n: 7, name: t("step.sign") })}</Kicker>
      <h1 className="h1"><Words key={t("sign.title")} text={t("sign.title")} accent={1} color="#B76A3B" /></h1>
      <p className="sub up" style={{ animationDelay: ".8s" }}>{tn("sign.sub", { mobile: <b style={{ color: "#142844" }}>+91 {data.mobileMasked}</b> })}</p>
      <div className="up" style={{ animationDelay: ".95s" }}><OtpInput value={code} onChange={setCode} autoFocus label={t("sign.codeLabel")} /></div>
      <div className="up" style={{ animationDelay: "1.05s" }}>
        {resendIn > 0 ? <span className="mono" style={{ fontSize: 12, color: "#637383" }}>{t("common.resendIn", { s: `0:${String(resendIn).padStart(2, "0")}` })}</span> : <button className="link" type="button" onClick={resend}>{t("common.newCode")}</button>}
      </div>
      <div className="up" style={{ animationDelay: "1.15s", borderRadius: 14, background: "#fff", border: "1px solid #D4DEE0", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <Icon name="pen" size={16} color="#B76A3B" />
        <span style={{ fontSize: 13.5 }}><b>{t("sign.doc", { code: data.centreCode, pages: plural("pages", pages) })}</b><span style={{ color: "#637383" }}> {t("sign.cert")}</span></span>
      </div>
      <ErrorBox>{err}</ErrorBox>
      <div style={{ flex: 1 }} />
      <Keypad value={code} onChange={setCode} max={6} disabled={busy} clearLabel={t("keypad.clear")} />
      <button className="btn btn-green up" type="button" style={{ animationDelay: "1.25s", width: "100%", minHeight: 54 }} disabled={code.length < 6 || busy} onClick={sign}>
        {busy ? <><Spinner /> {t("sign.signing")}</> : <><Icon name="pen" /> {t("sign.cta")}</>}
      </button>
    </div>
  );
}

/* ───────────────────────── done ───────────────────────── */

function DoneStep({ token, data }: { token: string; data: Data }) {
  const { t } = useI18n();
  useEffect(() => {
    const t = setTimeout(() => {
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.3 }, colors: ["#B76A3B", "#CB8A60", "#EBCDB8", "#142844", "#4A6A94", "#A7B9D1"], disableForReducedMotion: true });
    }, 1500);
    return () => clearTimeout(t);
  }, []);
  const s = data.signed!;
  return (
    <div className="screen top" style={{ paddingTop: 40 }}>
      <div className="curtain" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
        <Seal />
        <Kicker delay={0.6}>{t("done.kicker", { code: data.centreCode })}</Kicker>
        <h1 style={{ margin: 0, fontSize: 64, lineHeight: 0.92, fontWeight: 800, letterSpacing: "-0.045em" }}>
          <span className="w" style={{ animationDelay: ".8s", color: "#B76A3B" }}>{t("done.title")}</span>
        </h1>
        <p className="sub up" style={{ animationDelay: "1.1s" }}>{t("done.sub")}</p>
        <div className="card up" style={{ animationDelay: "1.3s", padding: "4px 16px" }}>
          <div className="kv"><span>{t("kv.signedAt")}</span><span className="mono" style={{ fontSize: 12.5 }}>{fmtIST(s.at)} IST</span></div>
          <div className="kv"><span>{t("kv.docId")}</span><span className="mono" style={{ fontSize: 12.5 }}>{s.documentId}</span></div>
          <div className="kv"><span>{t("kv.pages")}</span><span className="mono" style={{ fontSize: 12.5 }}>{t("done.pages", { n: s.pages })}</span></div>
        </div>
      </div>
      <a className="btn btn-ink up sheen" href={`/api/sign/${token}/signed`} style={{ animationDelay: "1.5s", width: "100%", minHeight: 54 }}>
        <Icon name="download" /> {t("common.downloadSigned")}
      </a>
      <a className="btn btn-ghost fade" href="/sign" style={{ animationDelay: "1.7s", width: "100%" }}>{t("done.other")}</a>
    </div>
  );
}

/* ───────────────────────── bits ───────────────────────── */

function InvalidLink() {
  const { t } = useI18n();
  return (
    <div className="stage phone">
      <div className="screen top">
        <Brand size={17} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
          <Kicker>{t("invalid.kicker")}</Kicker>
          <h1 className="h1"><Words key={t("invalid.title")} text={t("invalid.title")} /></h1>
          <p className="sub up" style={{ animationDelay: ".9s" }}>{t("invalid.sub")}</p>
        </div>
        <a className="btn btn-ink" href="/sign" style={{ width: "100%", minHeight: 54 }}>{t("invalid.cta")}</a>
      </div>
    </div>
  );
}

function initials(name?: string) {
  return (name ?? "").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "—";
}

