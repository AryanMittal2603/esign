"use client";

import Link from "next/link";
import { customName, examTitle } from "@/lib/format";

export type ExamStats = { total: number; sent: number; opened: number; uploaded: number; signed: number; pending: number; delivered?: number };
export type Exam = { id: string; name: string; examName: string | null; examDate: string | null; shift: string | null; stats: ExamStats };

export function Ring({ pct, size = 64 }: { pct: number; size?: number }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} viewBox="0 0 84 84" fill="none" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="42" cy="42" r="34" stroke="#E6ECEC" strokeWidth="10" />
        <circle cx="42" cy="42" r="34" stroke="#22A06B" strokeWidth="10" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct.toFixed(1)} 100`} />
      </svg>
      {size >= 48 && <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontWeight: 800, fontSize: size * (Math.round(pct) >= 100 ? 0.19 : 0.24), letterSpacing: "-0.03em" }}>{Math.round(pct)}%</span>}
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

      <div style={{ height: 6, display: "flex", background: "#EEF2F1", margin: "0 22px", borderRadius: 3, overflow: "hidden" }} aria-hidden="true">
        <span style={{ width: seg(stats.signed), background: "#2E7567" }} />
        <span style={{ width: seg(stats.uploaded - stats.signed), background: "#C9962B" }} />
        <span style={{ width: seg(stats.opened - stats.uploaded), background: "#2557DA" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", padding: "14px 22px 18px", gap: 8 }}>
        {([["Signatories", stats.total, "#142844"], ["Opened", stats.opened, "#2557DA"], ["Uploaded", stats.uploaded, "#7E5B12"], ["Signed", stats.signed, "#2E7567"]] as const).map(([l, v, c]) => (
          <div key={l} style={{ minWidth: 0 }}>
            <div style={{ ...label, fontSize: 9.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>
    </Link>
  );
}
