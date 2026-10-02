"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, Kicker, Spinner, Words, api, useCountUp } from "@/components/ui";
import { ExamCard, type Exam } from "@/components/admin/ExamCard";
import { NewExam } from "@/components/admin/NewExam";

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

  const sum = (exams ?? []).reduce(
    (a, p) => ({ total: a.total + p.stats.total, signed: a.signed + p.stats.signed, uploaded: a.uploaded + p.stats.uploaded, opened: a.opened + p.stats.opened }),
    { total: 0, signed: 0, uploaded: 0, opened: 0 },
  );
  const kpis = [
    { label: "Exams", v: exams?.length ?? 0, fg: "#142844", note: "exam events" },
    { label: "Signatories", v: sum.total, fg: "#142844", note: "one per centre" },
    { label: "Opened", v: sum.opened, fg: "#2557DA", note: "opened their link" },
    { label: "Signed", v: sum.signed, fg: "#2E7567", note: `${sum.total ? Math.round((sum.signed / sum.total) * 100) : 0}% of all CSRs` },
  ];
  const recent = (exams ?? []).slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Kicker delay={0.2}>Overview</Kicker>
          <h1 style={{ fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.04em" }}><Words text="Every exam, at a glance." start={0.3} accent={1} color="#B76A3B" /></h1>
        </div>
        <button className="btn btn-ink up" type="button" style={{ animationDelay: ".6s" }} onClick={() => setCreating(true)}><Icon name="plus" /> New exam</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {kpis.map((x, i) => (
          <div key={x.label} className="card up lift" style={{ animationDelay: `${0.4 + i * 0.07}s`, padding: "18px 18px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" }}>{x.label}</span>
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: x.fg }}>{Math.round(x.v * k)}</span>
            <span style={{ fontSize: 12.5, color: "#637383" }}>{x.note}</span>
          </div>
        ))}
      </div>

      {exams === null ? <Spinner /> : exams.length === 0 ? (
        <div className="card up" style={{ animationDelay: ".7s", padding: 40, textAlign: "center", display: "grid", gap: 12, justifyItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Create your first exam</div>
          <div style={{ color: "#637383" }}>One exam per event and shift. Add its centres and signatories next.</div>
          <button className="btn btn-ink" type="button" onClick={() => setCreating(true)}><Icon name="plus" /> New exam</button>
        </div>
      ) : (
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Kicker delay={0.7}>Recent exams</Kicker>
            <Link className="btn btn-ghost btn-sm fade" href="/admin/exams" style={{ animationDelay: ".8s" }}>View all {exams.length} <Icon name="next" size={16} /></Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {recent.map((p, i) => <ExamCard key={p.id} exam={p} k={k} delay={0.8 + i * 0.08} />)}
          </div>
        </section>
      )}

      {creating && <NewExam onClose={() => setCreating(false)} />}
    </div>
  );
}
