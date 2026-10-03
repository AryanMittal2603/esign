"use client";

import Link from "next/link";
import { customName, examTitle } from "@/lib/format";

export type ExamStats = { total: number; sent: number; opened: number; uploaded: number; signed: number; pending: number; delivered?: number };
export type Exam = { id: string; name: string; examName: string | null; examDate: string | null; shift: string | null; stats: ExamStats };

export function Ring({ pct, size = 64, dark = false }: { pct: number; size?: number; dark?: boolean }) {
  const done = Math.round(pct) >= 100;
  const stroke = size >= 48 ? 8 : 10;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} viewBox="0 0 84 84" fill="none" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="42" cy="42" r="34" stroke={dark ? "#FFFFFF1F" : "#E6ECF4"} strokeWidth={stroke} />
        {pct > 0 && <circle cx="42" cy="42" r="34" stroke={dark ? "#CB8A60" : "#B76A3B"} strokeWidth={stroke} strokeLinecap="round" pathLength={100} strokeDasharray={`${Math.max(0.5, pct).toFixed(1)} 100`} style={{ transition: "stroke-dasharray .6s ease" }} />}
      </svg>
      {size >= 48 ? (
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontWeight: 800, fontSize: size * (done ? 0.19 : 0.24), letterSpacing: "-0.03em", color: dark ? "#FFFFFF" : "#142844" }}>{Math.round(pct)}%</span>
      ) : done ? (
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#B76A3B" }}>
          <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
      ) : null}
    </div>
  );
}

export const label: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" };

export function ExamCard({ exam, k = 1, delay = 0 }: { exam: Exam; k?: number; delay?: number }) {
  const { stats } = exam;
  const pct = stats.total ? (stats.signed / stats.total) * 100 : 0;
  const seg = (n: number) => `${stats.total ? (n / stats.total) * 100 : 0}%`;

  return (
    <Link href={`/admin/exams/${exam.id}`} className="card lift up" style={{ animationDelay: `${delay}s`, padding: 0, display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit", overflow: "hidden" }}>
      <div style={{ padding: "20px 22px 16px", display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.25, overflowWrap: "anywhere" }}>{examTitle(exam)}</div>
          {customName(exam) && <div className="ellipsis" style={{ fontSize: 13, color: "#64748B", marginTop: -6 }}>{customName(exam)}</div>}
        </div>
        <Ring pct={pct * k} size={58} />
      </div>

      <div style={{ height: 6, display: "flex", background: "#E6ECF4", margin: "0 22px", borderRadius: 3, overflow: "hidden", gap: 2 }} aria-hidden="true">
        <span style={{ width: seg(stats.signed), background: "#B76A3B" }} />
        <span style={{ width: seg(stats.uploaded - stats.signed), background: "#DDAE8E" }} />
        <span style={{ width: seg(stats.opened - stats.uploaded), background: "#4A6A94" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", padding: "14px 22px 18px", gap: 8 }}>
        {([["Signatories", stats.total, "#142844"], ["Opened", stats.opened, "#4A6A94"], ["Uploaded", stats.uploaded, "#A65B30"], ["Signed", stats.signed, "#B76A3B"]] as const).map(([l, v, c]) => (
          <div key={l} style={{ minWidth: 0 }}>
            <div style={{ ...label, fontSize: 9.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>
    </Link>
  );
}
