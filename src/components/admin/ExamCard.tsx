"use client";

import Link from "next/link";

export type ExamStats = { total: number; sent: number; opened: number; uploaded: number; signed: number; pending: number };
export type Exam = { id: string; name: string; examName: string | null; examDate: string | null; shift: string | null; stats: ExamStats };

export function Ring({ pct, size = 64 }: { pct: number; size?: number }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} viewBox="0 0 84 84" fill="none" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="42" cy="42" r="34" stroke="#E6ECEC" strokeWidth="10" />
        <circle cx="42" cy="42" r="34" stroke="#2E7567" strokeWidth="10" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct.toFixed(1)} 100`} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontWeight: 800, fontSize: size * 0.23 }}>{Math.round(pct)}%</span>
    </div>
  );
}

export function ExamCard({ exam, k = 1, delay = 0 }: { exam: Exam; k?: number; delay?: number }) {
  const pct = exam.stats.total ? (exam.stats.signed / exam.stats.total) * 100 : 0;
  return (
    <Link href={`/admin/exams/${exam.id}`} className="card lift up" style={{ animationDelay: `${delay}s`, padding: 22, display: "flex", flexDirection: "column", gap: 16, textDecoration: "none", color: "inherit" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{exam.name}</div>
          <div className="mono" style={{ fontSize: 12, color: "#637383", marginTop: 6 }}>{[exam.examName, exam.examDate, exam.shift].filter(Boolean).join(" · ") || "—"}</div>
        </div>
        <Ring pct={pct * k} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
        {([["Centres", exam.stats.total, "#142844"], ["Opened", exam.stats.opened, "#2557DA"], ["Uploaded", exam.stats.uploaded, "#7E5B12"], ["Signed", exam.stats.signed, "#2E7567"]] as const).map(([l, v, c]) => (
          <div key={l}><div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#637383" }}>{l}</div><div style={{ fontSize: 20, fontWeight: 800, color: c, marginTop: 4 }}>{v}</div></div>
        ))}
      </div>
    </Link>
  );
}
