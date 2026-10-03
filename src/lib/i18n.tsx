"use client";

import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { EN, type Key } from "./i18n-en";
import { HI, MR } from "./i18n-hi-mr";
import { BN, TA, TE } from "./i18n-bn-te-ta";

export type Lang = "en" | "hi" | "bn" | "mr" | "te" | "ta";
export const LANGS: { code: Lang; label: string; english: string }[] = [
  { code: "en", label: "English", english: "English" },
  { code: "hi", label: "हिन्दी", english: "Hindi" },
  { code: "bn", label: "বাংলা", english: "Bengali" },
  { code: "mr", label: "मराठी", english: "Marathi" },
  { code: "te", label: "తెలుగు", english: "Telugu" },
  { code: "ta", label: "தமிழ்", english: "Tamil" },
];
const DICT: Record<Lang, Partial<Record<Key, string>>> = { en: EN, hi: HI, bn: BN, mr: MR, te: TE, ta: TA };
const STORE = "sq_lang";

type Vars = Record<string, string | number>;
type NodeVars = Record<string, React.ReactNode>;
type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Plain string with {placeholders} filled. */
  t: (key: Key, vars?: Vars) => string;
  /** Same, but placeholders may be React nodes (e.g. bold text). */
  tn: (key: Key, vars: NodeVars) => React.ReactNode;
  /** "{n} page" / "{n} pages" style plurals. */
  plural: (base: "pages" | "files", n: number) => string;
};

const I18n = createContext<Ctx | null>(null);

function fill(s: string, vars?: Vars) {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE) as Lang | null;
      if (saved && saved in DICT) setLangState(saved);
    } catch { /* storage blocked */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORE, l); } catch { /* storage blocked */ }
  }, []);

  const value = useMemo<Ctx>(() => {
    const raw = (key: Key) => DICT[lang][key] ?? EN[key];
    const t = (key: Key, vars?: Vars) => fill(raw(key), vars);
    const tn = (key: Key, vars: NodeVars) =>
      raw(key).split(/(\{\w+\})/g).map((part, i) => {
        const m = /^\{(\w+)\}$/.exec(part);
        return <Fragment key={i}>{m && m[1] in vars ? vars[m[1]] : part}</Fragment>;
      });
    const plural = (base: "pages" | "files", n: number) => t(`${base}_${n === 1 ? "one" : "other"}` as Key, { n });
    return { lang, setLang, t, tn, plural };
  }, [lang, setLang]);

  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18n);
  if (!c) throw new Error("useI18n must be used inside <LangProvider>");
  return c;
}

/** Has the device seen the welcome + language intro? */
export const INTRO_KEY = "sq_intro_v1";
