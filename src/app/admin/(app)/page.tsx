"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, Kicker, Spinner, Words, api, useCountUp } from "@/components/ui";
import { Ring, type Exam } from "@/components/admin/ExamCard";
import { NewExam } from "@/components/admin/NewExam";
import { customName, examTitle } from "@/lib/format";

const num = (n: number) => n.toLocaleString("en-IN");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

const SEGMENTS = [
  { key: "signed", label: "Signed", color: "#22A06B" },
  { key: "uploaded", label: "Uploaded", color: "#E0A100" },
  { key: "opened", label: "Opened", color: "#3B6FF0" },
  { key: "invited", label: "Invited, not opened", color: "#94A3B8" },
  { key: "notsent", label: "Not invited", color: "#E2E8F0" },
] as const;

function segmentsOf(s: Exam["stats"]) {
  return {
    signed: s.signed,
    uploaded: s.uploaded - s.signed,
    opened: s.opened - s.uploaded,
    invited: s.sent - s.opened,
    notsent: s.total - s.sent,
  } as Record<(typeof SEGMENTS)[number]["key"], number>;
}

function StackBar({ s, height = 8 }: { s: Exam["stats"]; height?: number }) {
  const seg = segmentsOf(s);
  return (
    <span style={{ height, display: "flex", background: "#EEF2F6", borderRadius: height, overflow: "hidden", gap: 2 }} aria-hidden="true">
      {SEGMENTS.filter((g) => g.key !== "notsent").map((g) => seg[g.key] > 0 && (
        <span key={g.key} className="grow" style={{ width: `${(seg[g.key] / (s.total || 1)) * 100}%`, background: g.color }} />
      ))}
    </span>
  );
}

export default function Overview() {
  const router = useRouter();
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
  const tot = all.reduce(
    (a, p) => ({ total: a.total + p.stats.total, sent: a.sent + p.stats.sent, opened: a.opened + p.stats.opened, uploaded: a.uploaded + p.stats.uploaded, signed: a.signed + p.stats.signed, pending: a.pending + p.stats.pending, delivered: a.delivered + (p.stats.delivered ?? 0) }),
    { total: 0, sent: 0, opened: 0, uploaded: 0, signed: 0, pending: 0, delivered: 0 },
  );
  const seg = segmentsOf(tot);
  const active = all.filter((e) => e.stats.total > 0 && e.stats.pending > 0).length;
  const complete = all.filter((e) => e.stats.total > 0 && e.stats.pending === 0).length;
  const order = (e: Exam) => (e.stats.total === 0 ? 2 : e.stats.pending > 0 ? 0 : 1);
  const rows = [...all].sort((a, b) => order(a) - order(b)).slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Kicker delay={0.2}>Overview</Kicker>
          <h1 style={{ fontSize: "clamp(28px, 3vw, 40px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.04em" }}><Words text="Every exam, at a glance." start={0.3} accent={1} color="#B76A3B" /></h1>
        </div>
        <button className="btn btn-ink up" type="button" style={{ animationDelay: ".5s" }} onClick={() => setCreating(true)}><Icon name="plus" /> New exam</button>
      </div>

      {exams === null ? <Spinner /> : all.length === 0 ? (
        <div className="card up" style={{ animationDelay: ".4s", padding: 44, textAlign: "center", display: "grid", gap: 12, justifyItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Create your first exam</div>
          <div style={{ color: "#64748B" }}>Pick the exam, date and shift. Add its signatories next.</div>
          <button className="btn btn-ink" type="button" onClick={() => setCreating(true)}><Icon name="plus" /> New exam</button>
        </div>
      ) : (
        <>
          {/* overall progress */}
          <section className="card up" style={{ animationDelay: ".35s", padding: 0, display: "flex", flexWrap: "wrap", overflow: "hidden" }} aria-label="Overall progress">
            <div style={{ flex: "2 1 440px", padding: "22px 24px", display: "flex", gap: 24, alignItems: "center", minWidth: 0 }}>
              <Ring pct={pct(tot.signed, tot.total) * k} size={112} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#64748B" }}>CSRs signed, all exams</div>
                  <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.035em", marginTop: 4 }}>{num(Math.round(tot.signed * k))} <span style={{ fontSize: 18, color: "#94A3B8", fontWeight: 700 }}>of {num(tot.total)}</span></div>
                </div>
                <StackBar s={tot} height={10} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
                  {SEGMENTS.map((g) => (
                    <span key={g.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#475569" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: g.color, border: g.key === "notsent" ? "1px solid #CBD5E1" : 0 }} />
                      {g.label} <b style={{ color: "#0F172A" }}>{num(seg[g.key])}</b>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ flex: "1 1 280px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", borderLeft: "1px solid #EEF2F6" }}>
              {[
                { label: "Active exams", v: active, sub: `${complete} complete`, fg: "#0F172A" },
                { label: "Signatories", v: tot.total, sub: `${num(tot.sent)} invited`, fg: "#0F172A" },
                { label: "Delivered", v: tot.delivered, sub: `${pct(tot.delivered, tot.sent)}% of invites`, fg: "#0F5F73" },
                { label: "Pending", v: tot.pending, sub: tot.pending ? "still to sign" : "nothing pending", fg: "#9A5530" },
              ].map((x, i) => (
                <div key={x.label} style={{ padding: "18px 20px", borderTop: i > 1 ? "1px solid #EEF2F6" : 0, borderLeft: i % 2 ? "1px solid #EEF2F6" : 0 }}>
                  <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#64748B" }}>{x.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.035em", color: x.fg, marginTop: 6 }}>{num(Math.round(x.v * k))}</div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{x.sub}</div>
                </div>
              ))}
            </div>
          </section>

          {/* exams table */}
          <section className="card up" style={{ animationDelay: ".5s", padding: 0, overflow: "hidden" }} aria-label="Exams">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid #E2E8F0" }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>Exams <span className="mono" style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>· active first</span></span>
              <Link className="btn btn-ghost btn-sm" href="/admin/exams">View all {num(all.length)} <Icon name="next" size={16} /></Link>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div className="tbl" style={{ minWidth: 860 }}>
                <div className="tbl-row tbl-head" style={{ gridTemplateColumns: OCOLS }}>
                  <span>Exam</span><span>Signatories</span><span>Delivered</span><span>Progress</span><span>Signed</span><span>Status</span>
                </div>
                {rows.map((e) => {
                  const s = e.stats;
                  const cn = customName(e);
                  return (
                    <div key={e.id} className="tbl-row" role="link" tabIndex={0} onClick={() => router.push(`/admin/exams/${e.id}`)} onKeyDown={(ev) => { if (ev.key === "Enter") router.push(`/admin/exams/${e.id}`); }} style={{ gridTemplateColumns: OCOLS, cursor: "pointer" }}>
                      <span style={{ flexDirection: "column", alignItems: "flex-start", justifyContent: "center" }}>
                        <Link href={`/admin/exams/${e.id}`} className="ellipsis" style={{ maxWidth: "100%", fontWeight: 700, color: "#0F172A", textDecoration: "none" }} onClick={(ev) => ev.stopPropagation()}>{examTitle(e)}</Link>
                        {cn && <span className="ellipsis" style={{ maxWidth: "100%", fontSize: 12, color: "#64748B", marginTop: 3 }}>{cn}</span>}
                      </span>
                      <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{num(s.total)}</span>
                      <span style={{ flexDirection: "column", alignItems: "flex-start", justifyContent: "center" }}>
                        <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{num(s.delivered ?? 0)}</span>
                        <span className="mono" style={{ fontSize: 10.5, color: "#64748B", marginTop: 2 }}>{s.sent ? `${pct(s.delivered ?? 0, s.sent)}% of ${num(s.sent)} invited` : "none invited"}</span>
                      </span>
                      <span style={{ flexDirection: "column", alignItems: "stretch", justifyContent: "center", gap: 6 }}>
                        <StackBar s={s} />
                        <span className="mono" style={{ fontSize: 10.5, color: "#64748B" }}>{num(s.opened)} opened · {num(s.uploaded)} uploaded</span>
                      </span>
                      <span style={{ gap: 10 }}><Ring pct={pct(s.signed, s.total) * k} size={36} /><span className="mono" style={{ fontSize: 12.5 }}>{num(s.signed)}/{num(s.total)}</span></span>
                      <span>
                        {s.total === 0 ? <span className="pill" style={{ background: "#F1F5F9", color: "#475569" }}><span className="pill-dot" style={{ background: "#94A3B8" }} />No signatories</span>
                          : s.pending === 0 ? <span className="pill" style={{ background: "#E4F4EC", color: "#17694F" }}><span className="pill-dot" style={{ background: "#22A06B" }} />Complete</span>
                          : <span className="pill" style={{ background: "#FFF4DB", color: "#8A5A00" }}><span className="pill-dot" style={{ background: "#E0A100" }} />{num(s.pending)} pending</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}

      {creating && <NewExam onClose={() => setCreating(false)} />}
    </div>
  );
}

const OCOLS = "minmax(240px, 2fr) 110px 150px minmax(180px, 1.4fr) 130px 150px";
