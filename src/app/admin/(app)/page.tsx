"use client";

import { Guilloche } from "@/components/admin/Guilloche";
import { STAGE } from "@/components/admin/palette";
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
  { key: "signed", label: "Signed", color: STAGE.signed, dark: "#CB8A60" },
  { key: "uploaded", label: "Uploaded", color: STAGE.uploaded, dark: "#EBCDB8" },
  { key: "opened", label: "Opened", color: STAGE.opened, dark: "#A7B9D1" },
  { key: "invited", label: "Invited, not opened", color: STAGE.invited, dark: "#FFFFFF4D" },
  { key: "notsent", label: "Not invited", color: STAGE.notsent, dark: "#FFFFFF1A" },
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

function StackBar({ s, height = 8, dark = false }: { s: Exam["stats"]; height?: number; dark?: boolean }) {
  const seg = segmentsOf(s);
  return (
    <span style={{ height, display: "flex", background: dark ? "#FFFFFF14" : "#EEF2F7", borderRadius: height, overflow: "hidden", gap: 2 }} aria-hidden="true">
      {SEGMENTS.filter((g) => g.key !== "notsent").map((g) => seg[g.key] > 0 && (
        <span key={g.key} className="grow" style={{ width: `${(seg[g.key] / (s.total || 1)) * 100}%`, background: dark ? g.dark : g.color, borderRadius: height }} />
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
          <section className="up hero-grid" style={{ animationDelay: ".35s" }} aria-label="Overall progress">
            <div className="hero-panel">
              <Guilloche />
              <div style={{ position: "relative", display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
                <Ring pct={pct(tot.signed, tot.total) * k} size={128} dark />
                <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#A7B9D1" }}>CSRs signed · all exams</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
                      <span style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1, color: "#FFFFFF" }}>{num(Math.round(tot.signed * k))}</span>
                      <span style={{ fontSize: 18, color: "#7590B4", fontWeight: 700 }}>of {num(tot.total)}</span>
                    </div>
                  </div>
                  <StackBar s={tot} height={10} dark />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px" }}>
                    {SEGMENTS.map((g) => (
                      <span key={g.key} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#CDD8E6" }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: g.dark, boxShadow: g.key === "notsent" ? "inset 0 0 0 1px #FFFFFF33" : undefined }} />
                        {g.label} <b style={{ color: "#FFFFFF" }}>{num(seg[g.key])}</b>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="hero-stats">
              {[
                { label: "Active exams", v: active, sub: `${num(complete)} complete`, icon: "folder", tone: "navy" },
                { label: "Signatories", v: tot.total, sub: `${num(tot.sent)} invited`, icon: "users", tone: "navy" },
                { label: "Delivered", v: tot.delivered, sub: `${pct(tot.delivered, tot.sent)}% of invites`, icon: "send", tone: "navy" },
                { label: "Pending", v: tot.pending, sub: tot.pending ? "still to sign" : "nothing pending", icon: "pen", tone: "copper" },
              ].map((x) => (
                <div key={x.label} className="card stat-tile">
                  <span className={`stat-ico ${x.tone}`}><Icon name={x.icon as "folder"} size={18} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#7590B4" }}>{x.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, color: x.tone === "copper" ? "#A65B30" : "#142844", marginTop: 4 }}>{num(Math.round(x.v * k))}</div>
                    <div style={{ fontSize: 12, color: "#4A6A94", marginTop: 3 }}>{x.sub}</div>
                  </div>
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
                        {s.total === 0 ? <span className="pill" style={{ background: "#F3F6FA", color: "#7590B4" }}><span className="pill-dot" style={{ background: "#CDD8E6" }} />No signatories</span>
                          : s.pending === 0 ? <span className="pill" style={{ background: "#B76A3B", color: "#FFFFFF" }}><Icon name="check" size={13} stroke={3} />Complete</span>
                          : <span className="pill" style={{ background: "#E6ECF4", color: "#1F3A5F" }}><span className="pill-dot pulse" style={{ background: "#4A6A94" }} />{num(s.pending)} pending</span>}
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
