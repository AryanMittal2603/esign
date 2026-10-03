"use client";

import Link from "next/link";
import Papa from "papaparse";
import { use, useRef, useState } from "react";
import { ErrorBox, Icon, Kicker, Seal, Spinner, Words, api, useCountUp } from "@/components/ui";
import { fmtBytes } from "@/lib/format";

type Issue = { row: number; field: string; value: string; problem: string };
type Check = { valid: number; issues: Issue[]; issueCount: number; badRows: number; total: number; preview: { name: string; mobile: string; centreCode: string; centreName: string }[] };

export default function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number; rows: Record<string, unknown>[] } | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ added: number; skipped: number } | null>(null);
  const k = useCountUp([check]);

  const read = (f: File) => {
    setErr(""); setCheck(null); setDone(null);
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") { setErr("Please choose a .csv file. In Excel use File → Save As → CSV."); return; }
    setBusy(true);
    Papa.parse<Record<string, unknown>>(f, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: async (res) => {
        const rows = res.data;
        setFile({ name: f.name, size: f.size, rows });
        try { setCheck(await api<Check>(`/api/admin/projects/${id}/import`, { method: "POST", json: { rows, commit: false } })); }
        catch (e) { setErr((e as Error).message); }
        setBusy(false);
      },
      error: (e) => { setErr(e.message); setBusy(false); },
    });
  };

  const commit = async () => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const r = await api<{ added: number; skipped: number }>(`/api/admin/projects/${id}/import`, { method: "POST", json: { rows: file.rows, commit: true } });
      setDone(r);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const badRows = check?.badRows ?? 0;
  const stage = done ? 4 : check ? 3 : file ? 2 : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1120, margin: "0 auto" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <Link className="btn btn-ghost btn-sm fade" href={`/admin/exams/${id}`} style={{ paddingLeft: 8 }}><Icon name="back" size={16} stroke={2} /> Back to exam</Link>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 6 }} aria-label="Import steps">
          {["Template", "Upload", "Validate", "Import"].map((label, i) => {
            const n = i + 1, past = n < stage || (done && n === 4), cur = n === stage && !done;
            return (
              <li key={label} className="up" style={{ animationDelay: `${0.3 + i * 0.06}s`, display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 14px 0 6px", borderRadius: 999, background: cur ? "#142844" : "#fff", color: cur ? "#fff" : "#142844", fontSize: 13, fontWeight: 600 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", background: past ? "#142844" : cur ? "#fff" : "#E6ECEC", color: past ? "#fff" : "#142844", font: "600 11px var(--font-mono)" }}>{past ? "✓" : n}</span>{label}
              </li>
            );
          })}
        </ol>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Kicker delay={0.2}>Bulk onboarding</Kicker>
        <h1 style={{ fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.04em" }}><Words text="Import signatories from CSV." start={0.3} accent={1} color="#B76A3B" /></h1>
        <p className="up" style={{ animationDelay: ".7s", margin: 0, maxWidth: 640, fontSize: 16, lineHeight: 1.55, color: "#637383" }}>One row per centre. Every row is checked before anything is saved, so you fix problems once, not on exam day.</p>
      </div>

      {done ? (
        <section className="card" style={{ position: "relative", overflow: "hidden", padding: "clamp(28px, 5vw, 56px)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 36 }}>
          <div className="curtain" />
          <Seal size={140} />
          <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <Kicker delay={0.5}>4 · Imported</Kicker>
            <h2 style={{ fontSize: "clamp(30px, 3.4vw, 44px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.04em" }}><Words text={`${done.added} signatories added.`} start={0.6} accent={1} color="#B76A3B" /></h2>
            <p className="up" style={{ animationDelay: "1s", margin: 0, fontSize: 16, lineHeight: 1.55, color: "#637383" }}>A unique secure link was created for every centre{done.skipped ? `. ${done.skipped} rows with problems were skipped` : ""}. Send links from the exam page.</p>
            <div className="up" style={{ animationDelay: "1.2s", display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link className="btn btn-ink" href={`/admin/exams/${id}`}>Go to exam</Link>
              <button className="btn btn-ghost" type="button" onClick={() => { setDone(null); setFile(null); setCheck(null); }}>Import another file</button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <section className="card up" style={{ animationDelay: ".8s", flex: "1 1 320px", minWidth: 0, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" }}>1 · Template</span>
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Four columns, nothing else</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["name", "mobile", "centre_code", "centre_name"].map((c) => <span key={c} className="mono" style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, background: "#DCECF2" }}>{c}</span>)}
              </div>
              <a className="btn btn-line btn-sm" href="/api/admin/template" style={{ alignSelf: "flex-start" }}><Icon name="download" size={16} /> Download CSV template</a>
            </section>

            <section
              className={`up drop${over ? " over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) read(f); }}
              style={{ animationDelay: ".9s", flex: "2 1 520px", minWidth: 0, borderRadius: 18, border: "1.5px dashed #A8BBC2", background: "#FFFFFFB3", padding: 22, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18 }}
            >
              <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} />
              <svg width="64" height="76" viewBox="0 0 64 76" fill="none" aria-hidden="true" style={{ flex: "none" }} key={file?.name ?? "none"}>
                <path d="M8 4h34l16 16v48a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill="#FFFFFF" stroke="#142844" strokeWidth="2" pathLength={1} className="draw" style={{ animationDelay: ".2s" }} />
                <path d="M42 4v16h16" stroke="#142844" strokeWidth="2" pathLength={1} className="draw" style={{ animationDelay: ".6s" }} />
                <rect x="12" y="40" width="40" height="18" rx="4" fill={file ? "#142844" : "#A8BBC2"} className="pop" style={{ animationDelay: ".8s", transformBox: "fill-box", transformOrigin: "center" }} />
                <text x="32" y="53" textAnchor="middle" fill="#FFFFFF" style={{ font: "700 10px var(--font-mono)" }}>CSV</text>
              </svg>
              <div style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" }}>2 · Your file</span>
                {file ? (
                  <>
                    <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", overflowWrap: "anywhere" }}>{file.name}</span>
                    <span className="mono" style={{ fontSize: 12, color: "#637383" }}>{file.rows.length} rows · {fmtBytes(file.size)}</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Drop your CSV here</span>
                    <span style={{ fontSize: 13, color: "#637383" }}>or choose it from your computer</span>
                  </>
                )}
                {busy && <span style={{ height: 5, borderRadius: 3, background: "#E6ECEC", overflow: "hidden", marginTop: 6 }}><span className="grow" style={{ display: "block", height: "100%", width: "100%", background: "#142844", animationDuration: "1.6s" }} /></span>}
              </div>
              <button className="btn btn-line btn-sm" type="button" onClick={() => input.current?.click()}>{file ? "Replace file" : "Choose file"}</button>
            </section>
          </div>

          <ErrorBox>{err}</ErrorBox>

          {check && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <Stat label="Rows checked" v={Math.round(check.total * k)} />
                <Stat label="Ready to import" v={Math.round(check.valid * k)} color="#142844" delay={0.1} />
                <Stat label="Need a fix" v={Math.round(badRows * k)} color={badRows ? "#9A5530" : "#142844"} delay={0.2} border={badRows ? "#E2C4AF" : undefined} />
              </div>

              {check.issues.length > 0 && (
                <section className="card up" style={{ animationDelay: ".4s", padding: 0, overflow: "hidden" }} aria-label="Rows that need a fix">
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "18px 20px", borderBottom: "1px solid #E6ECEC" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9A5530" }}>3 · Validate</span>
                      <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{badRows} {badRows === 1 ? "row" : "rows"} will be skipped</span>
                    </div>
                    <button className="btn btn-line btn-sm" type="button" onClick={async () => { const full = await api<Check>(`/api/admin/projects/${id}/import`, { method: "POST", json: { rows: file!.rows, commit: false, full: true } }); downloadIssues(full.issues); }}>Download error report</button>
                  </div>
                  <div style={{ overflowX: "auto", maxHeight: 420 }}>
                    <div style={{ minWidth: 820 }}>
                      <div className="grid-row th" style={{ gridTemplateColumns: ICOLS }}><span>Row</span><span>Field</span><span>Value</span><span>What to fix</span></div>
                      {check.issues.slice(0, 300).map((i, n) => (
                        <div key={n} className="grid-row up" style={{ gridTemplateColumns: ICOLS, animationDelay: `${Math.min(1.2, 0.5 + n * 0.05)}s` }}>
                          <span className="mono" style={{ fontWeight: 600 }}>{i.row}</span>
                          <span className="mono" style={{ fontSize: 12.5 }}>{i.field}</span>
                          <span className="mono ellipsis" style={{ fontSize: 12.5, color: "#9A5530", background: "#F6E9E0", padding: "4px 8px", borderRadius: 6, justifySelf: "start", maxWidth: "100%" }}>{i.value}</span>
                          <span>{i.problem}</span>
                        </div>
                      ))}
                      {check.issueCount > 300 && <div style={{ padding: "12px 20px", borderTop: "1px solid #EEF2F1", fontSize: 13, color: "#637383" }}>Showing the first 300 of {check.issueCount.toLocaleString("en-IN")} problems. Download the error report for the full list.</div>}
                    </div>
                  </div>
                </section>
              )}

              {check.preview.length > 0 && (
                <section className="card up" style={{ animationDelay: ".55s", padding: 0, overflow: "hidden" }} aria-label="Preview">
                  <div style={{ padding: "18px 20px", borderBottom: "1px solid #E6ECEC", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Preview · first {check.preview.length} of {check.valid}</span>
                    <span className="chip" style={{ background: "#E6ECF4", color: "#142844" }}>Checks passed</span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ minWidth: 760 }}>
                      <div className="grid-row th" style={{ gridTemplateColumns: PCOLS }}><span>name</span><span>mobile</span><span>centre_code</span><span>centre_name</span></div>
                      {check.preview.map((p) => (
                        <div key={p.centreCode} className="grid-row" style={{ gridTemplateColumns: PCOLS }}>
                          <span style={{ fontWeight: 600 }}>{p.name}</span><span className="mono" style={{ fontSize: 12.5 }}>{p.mobile}</span><span className="mono" style={{ fontSize: 12.5 }}>{p.centreCode}</span><span>{p.centreName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              <div className="up" style={{ animationDelay: ".7s", display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 10 }}>
                <Link className="btn btn-ghost" href={`/admin/exams/${id}`}>Cancel</Link>
                <button className="btn btn-ink" type="button" disabled={!check.valid || busy} onClick={commit}>{busy ? <Spinner /> : null} Import {check.valid} signatories</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

const ICOLS = "70px 130px 170px minmax(260px, 1fr)";
const PCOLS = "minmax(180px, 1fr) 150px 110px minmax(260px, 1.6fr)";

function Stat({ label, v, color = "#142844", delay = 0, border }: { label: string; v: number; color?: string; delay?: number; border?: string }) {
  return (
    <div className="card up" style={{ animationDelay: `${delay}s`, padding: 18, display: "flex", flexDirection: "column", gap: 6, borderColor: border }}>
      <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#637383" }}>{label}</span>
      <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.04em", color }}>{v}</span>
    </div>
  );
}

function downloadIssues(issues: Issue[]) {
  const csv = Papa.unparse(issues.map((i) => ({ row: i.row, field: i.field, value: i.value, problem: i.problem })));
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "import_errors.csv" });
  a.click();
  URL.revokeObjectURL(url);
}
