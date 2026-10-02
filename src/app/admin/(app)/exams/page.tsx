"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon, Kicker, Spinner, Words, api, useCountUp } from "@/components/ui";
import { ExamCard, type Exam } from "@/components/admin/ExamCard";
import { NewExam } from "@/components/admin/NewExam";

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const k = useCountUp([exams === null]);

  useEffect(() => {
    const load = () => api<{ projects: Exam[] }>("/api/admin/projects").then((d) => setExams(d.projects)).catch(() => setExams([]));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (exams ?? []).filter((e) => !needle || [e.name, e.examName, e.examDate, e.shift].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [exams, q]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Kicker delay={0.2}>Exams</Kicker>
          <h1 style={{ fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.04em" }}><Words text="All exams." start={0.3} accent={1} color="#B76A3B" /></h1>
        </div>
        <div className="up" style={{ animationDelay: ".6s", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {exams && exams.length > 3 && (
            <label style={{ position: "relative", width: 260 }}>
              <Icon name="search" size={16} color="#637383" stroke={2} style={{ position: "absolute", left: 14, top: 13 }} />
              <input className="field" style={{ height: 42, paddingLeft: 40, fontSize: 14 }} placeholder="Search exams" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exams" />
            </label>
          )}
          <button className="btn btn-ink" type="button" onClick={() => setCreating(true)}><Icon name="plus" /> New exam</button>
        </div>
      </div>

      {exams === null ? <Spinner /> : exams.length === 0 ? (
        <div className="card up" style={{ animationDelay: ".5s", padding: 40, textAlign: "center", display: "grid", gap: 12, justifyItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>No exams yet</div>
          <div style={{ color: "#637383" }}>Create an exam, then import its centres and signatories from CSV.</div>
          <button className="btn btn-ink" type="button" onClick={() => setCreating(true)}><Icon name="plus" /> New exam</button>
        </div>
      ) : shown.length === 0 ? (
        <div style={{ color: "#637383", padding: "20px 0" }}>No exams match “{q}”.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {shown.map((p, i) => <ExamCard key={p.id} exam={p} k={k} delay={0.5 + Math.min(i, 8) * 0.06} />)}
        </div>
      )}

      {creating && <NewExam onClose={() => setCreating(false)} />}
    </div>
  );
}
