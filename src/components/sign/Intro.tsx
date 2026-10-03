"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Brand, Icon } from "@/components/ui";
import { INTRO_KEY, LANGS, LangProvider, useI18n, type Lang } from "@/lib/i18n";
import { Rosette } from "./Rosette";

const GREETINGS = ["Namaste", "नमस्ते", "নমস্কার", "नमस्कार", "నమస్తే", "வணக்கம்"];

/** Wraps the signatory app: language context + a one-time welcome / language / before-we-begin intro. */
export function SignerApp({ children }: { children: React.ReactNode }) {
  return <LangProvider><Gate>{children}</Gate></LangProvider>;
}

function Gate({ children }: { children: React.ReactNode }) {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    let v = false;
    try { v = localStorage.getItem(INTRO_KEY) === "1"; } catch { /* storage blocked: show intro each visit */ }
    setSeen(v);
  }, []);
  if (seen === null) return <div className="stage phone intro" />;
  if (!seen) {
    return <Intro onDone={() => { try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* ignore */ } setSeen(true); }} />;
  }
  return <>{children}</>;
}

function Intro({ onDone }: { onDone: () => void }) {
  const { t, lang, setLang } = useI18n();
  const [page, setPage] = useState(0);
  const [g, setG] = useState(0);

  useEffect(() => {
    if (page !== 0) return;
    const id = setInterval(() => setG((n) => (n + 1) % GREETINGS.length), 1700);
    return () => clearInterval(id);
  }, [page]);

  const next = () => (page < 2 ? setPage(page + 1) : onDone());
  const cta = page === 0 ? t("intro.proceed") : page === 1 ? t("intro.continue") : t("intro.start");

  return (
    <div className="stage phone intro">
      <Rosette size={760} className="intro-rosette" />
      <div className="intro-body" key={page}>
        {page === 0 && (
          <div className="intro-center">
            <div className="fade"><Brand size={22} /></div>
            <div className="intro-greet" aria-live="polite">
              <span key={g} className="greet-word">{GREETINGS[g]}</span>
            </div>
            <p className="intro-sub up" style={{ animationDelay: ".5s" }}>{t("intro.welcome")}</p>
          </div>
        )}

        {page === 1 && (
          <div className="intro-col">
            <div className="fade"><Brand size={18} /></div>
            <h1 className="intro-h up" style={{ animationDelay: ".1s" }}>{t("intro.chooseLang")}{lang !== "hi" && <span className="intro-h-alt"> / भाषा चुनें</span>}</h1>
            <div className="lang-grid" role="radiogroup" aria-label={t("intro.chooseLang")}>
              {LANGS.map((l, i) => (
                <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} className={`lang-tile up${lang === l.code ? " on" : ""}`}
                  style={{ animationDelay: `${0.15 + i * 0.05}s` }} onClick={() => setLang(l.code as Lang)}>
                  <span className="lang-native">{l.label}</span>
                  <span className="lang-en">{l.english}</span>
                  {lang === l.code && <span className="lang-check"><Icon name="check" size={13} stroke={3} /></span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {page === 2 && (
          <div className="intro-col">
            <div className="kicker" style={{ marginTop: 30 }}>{t("intro.before")}</div>
            {([
              ["intro.c1t", "intro.c1d", "pen"],
              ["intro.c2t", "intro.c2d", "phone"],
              ["intro.c3t", "intro.c3d", "shield"],
            ] as const).map(([title, desc, icon], i) => (
              <div key={title} className="glass-card up" style={{ animationDelay: `${0.12 + i * 0.12}s` }}>
                <span className="glass-ico"><Icon name={icon} size={22} stroke={1.9} /></span>
                <span style={{ minWidth: 0 }}>
                  <span className="glass-t">{t(title)}</span>
                  <span className="glass-d">{t(desc)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="intro-foot">
        <div className="intro-dots" role="tablist">
          {[0, 1, 2].map((i) => (
            <button key={i} type="button" role="tab" aria-selected={page === i} aria-label={`${i + 1} / 3`} className={page === i ? "on" : ""} onClick={() => setPage(i)} />
          ))}
        </div>
        <button className="btn btn-ink" type="button" onClick={next} style={{ width: "100%", minHeight: 56 }}>
          {cta} <Icon name="next" size={18} stroke={2.2} />
        </button>
      </div>
    </div>
  );
}

/** Small language switcher for the signatory screens. */
export function LangButton({ light = false }: { light?: boolean }) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const cur = LANGS.find((l) => l.code === lang)!;
  return (
    <>
      <button type="button" className={`lang-btn${light ? " light" : ""}`} onClick={() => setOpen(true)} aria-label={t("common.language")}>
        <Icon name="globe" size={15} stroke={2} /> {cur.label}
      </button>
      {open && createPortal(
        <div className="sheet-back" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-label={t("common.language")} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>{t("intro.chooseLang")}</div>
            <div className="lang-grid">
              {LANGS.map((l) => (
                <button key={l.code} type="button" className={`lang-tile${lang === l.code ? " on" : ""}`} onClick={() => { setLang(l.code); setOpen(false); }}>
                  <span className="lang-native">{l.label}</span>
                  <span className="lang-en">{l.english}</span>
                  {lang === l.code && <span className="lang-check"><Icon name="check" size={13} stroke={3} /></span>}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

