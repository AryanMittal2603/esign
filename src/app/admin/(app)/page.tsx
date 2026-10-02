"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, Kicker, Spinner, Words, api, useCountUp } from "@/components/ui";
import { Ring, type Exam } from "@/components/admin/ExamCard";
import { NewExam } from "@/components/admin/NewExam";

const num = (n: number) => n.toLocaleString("en-IN");

export default function Overview() {
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [creating, setCreating] = useState(false);
  const k = useCountUp([exams === null]);

  useEffect(() => {
    const load = () => api<{ projects: Exam[] }>("/api/admin/projects").then((d) => setExams(d.projects)).catch(() => setExams([]));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const all = exams ?? [];
  const sum = all.reduce((a, p) => ({ total: a.total + p.stats.total, signed: a.signed + p.stats.signed, opened: a.opened + p.stats.opened, pending: a.pending + p.stats.pending }), { total: 0, signed: 0, opened: 0, pending: 0 });
  const signedPct = sum.total ? Math.round((sum.signed / sum.total) * 100) : 0;
  const kpis = [
    { label: "Exams", v: all.length, fg: "#142844", note: `${all.filter((e) => e.stats.total && e.stats.pending === 0).length} complete` },
    { label: "Signatories", v: sum.total, fg: "#142844", note: "across all exams" },
    { label: "Signed", v: sum.signed, fg: "#2E7567", note: `${signedPct}% of all CSRs` },
    { label: "Pending", v: sum.pending, fg: "#9A5530", note: sum.pending ? "still to sign" : "nothing pending" },
  ];
  // active exams (with pending signatories) first, then complete, then empty
  const order = (e: Exam) => (e.stats.total === 0 ? 2 : e.stats.pending > 0 ? 0 : 1);
  const rows = [...all].sort((a, b) => order(a) - order(b)).slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Kicker delay={0.2}>Overview</Kicker>
          <h1 style={{ fontSize: "clamp(30px, 3.4vw, 46px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.04em" }}><Words text="Every exam, at a glance." start={0.3} accent={1} color="#B76A3B" /></h1>
        </div>
        <button className="btn btn-ink up" type="button" style={{ animationDelay: ".6s" }} onClick={() => setCreating(true)}><Icon name="plus" /> New exam</button>
      </div>

      <section className="card up" style={{ animationDelay: ".4s", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }} aria-label="Totals">
        {kpis.map((x, i) => (
          <div key={x.label} style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 8, borderLeft: i ? "1px solid #EEF2F1" : 0 }}>
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" }}>{x.label}</span>
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: x.fg }}>{num(Math.round(x.v * k))}</span>
            <span style={{ fontSize: 12.5, color: "#637383" }}>{x.note}</span>
          </div>
        ))}
      </section>

      {exams === null ? <Spinner /> : all.length === 0 ? (
        <div className="card up" style={{ animationDelay: ".6s", padding: 40, textAlign: "center", display: "grid", gap: 12, justifyItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Create your first exam</div>
          <div style={{ color: "#637383" }}>Pick the exam, date and shift. Add its signatories next.</div>
          <button className="btn btn-ink" type="button" onClick={() => setCreating(true)}><Icon name="plus" /> New exam</button>
        </div>
      ) : (
        <section className="card up" style={{ animationDelay: ".55s", padding: 0, overflow: "hidden" }} aria-label="Exam progress">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid #E6ECEC" }}>
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9A5530" }}>Exam progress</span>
            <Link className="btn btn-ghost btn-sm" href="/admin/exams">All {num(all.length)} exams <Icon name="next" size={16} /></Link>
          </div>
          {rows.map((e, i) => {
            const s = e.stats;
            const w = (n: number) => `${s.total ? (n / s.total) * 100 : 0}%`;
            const pct = s.total ? (s.signed / s.total) * 100 : 0;
            return (
              <Link key={e.id} href={`/admin/exams/${e.id}`} className="tr up" style={{ animationDelay: `${0.65 + i * 0.05}s`, display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(160px, 1.4fr) 120px 44px", alignItems: "center", gap: 18, padding: "14px 20px", borderTop: i ? "1px solid #EEF2F1" : 0, textDecoration: "none", color: "inherit" }}>
                <span style={{ minWidth: 0 }}>
                  <span className="ellipsis" style={{ display: "block", fontWeight: 800, fontSize: 15.5, letterSpacing: "-0.01em" }}>{e.name}</span>
                  <span className="mono ellipsis" style={{ display: "block", fontSize: 11.5, color: "#637383", marginTop: 3 }}>{[e.examName, e.examDate, e.shift].filter(Boolean).join(" · ") || "—"}</span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ height: 8, display: "flex", background: "#EEF2F1", borderRadius: 4, overflow: "hidden" }} aria-hidden="true">
                    <span style={{ width: w(s.signed), background: "#2E7567" }} />
                    <span style={{ width: w(s.uploaded - s.signed), background: "#C9962B" }} />
                    <span style={{ width: w(s.opened - s.uploaded), background: "#2557DA" }} />
                    <span style={{ width: w(s.sent - s.opened), background: "#A8BBC2" }} />
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: "#637383" }}>{num(s.signed)} signed · {num(s.uploaded - s.signed)} uploaded · {num(s.opened - s.uploaded)} opened</span>
                </span>
                <span style={{ textAlign: "right" }}>
                  {s.total === 0 ? <span className="chip" style={{ background: "#EEF2F1", color: "#56636F" }}>No signatories</span>
                    : s.pending === 0 ? <span className="chip" style={{ background: "#E3F0EC", color: "#2E7567" }}>Complete</span>
                    : <span style={{ fontWeight: 700, fontSize: 14 }}>{num(s.pending)} <span style={{ fontWeight: 500, color: "#637383", fontSize: 12.5 }}>pending</span></span>}
                </span>
                <Ring pct={pct * k} size={44} />
              </Link>
            );
          })}
        </section>
      )}

      {creating && <NewExam onClose={() => setCreating(false)} />}
    </div>
  );
}
