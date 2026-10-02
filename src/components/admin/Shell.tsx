"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Brand, Icon, api } from "@/components/ui";

type P = { id: string; name: string; stats: { total: number; signed: number } };
const Ctx = createContext<{ refreshProjects: () => void }>({ refreshProjects: () => {} });
export const useShell = () => useContext(Ctx);

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<P[]>([]);

  const refreshProjects = useCallback(() => {
    api<{ projects: P[] }>("/api/admin/projects").then((d) => setProjects(d.projects)).catch(() => {});
  }, []);
  useEffect(() => { refreshProjects(); }, [refreshProjects, path]);

  const signOut = async () => { await api("/api/admin/logout", { method: "POST" }); router.replace("/admin/login"); };
  const navStyle = (on: boolean) => (on ? { background: "#FFFFFF1A", color: "#FFFFFF" } : undefined);

  return (
    <Ctx.Provider value={{ refreshProjects }}>
      <div style={{ minHeight: "100vh", display: "flex", flexWrap: "wrap", background: "#F3F6F4" }}>
        <aside style={{ flex: "1 1 232px", minWidth: 0, background: "#142844", color: "#fff", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 28 }}>
          <Link href="/admin" style={{ padding: "0 8px", textDecoration: "none" }}><Brand size={18} light /></Link>
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }} aria-label="Main">
            <Link className="nav" href="/admin" style={navStyle(path === "/admin")}><Icon name="grid" /> Overview</Link>
            <Link className="nav" href="/admin/audit" style={navStyle(path === "/admin/audit")}><Icon name="shield" /> Audit trail</Link>
          </nav>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="mono" style={{ padding: "0 12px", fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#8FA3B8" }}>Projects</span>
            {projects.length === 0 && <span style={{ padding: "0 12px", fontSize: 13, color: "#A9BACB" }}>No projects yet</span>}
            {projects.map((p) => {
              const pct = p.stats.total ? Math.round((p.stats.signed / p.stats.total) * 100) : 0;
              const on = path.startsWith(`/admin/projects/${p.id}`);
              return (
                <Link key={p.id} href={`/admin/projects/${p.id}`} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", borderRadius: 11, textDecoration: "none", color: "#fff", background: on ? "#FFFFFF1A" : "transparent" }}>
                  <span className="ellipsis" style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</span>
                  <span style={{ height: 4, borderRadius: 2, background: "#FFFFFF22", overflow: "hidden" }}><span className="grow" style={{ display: "block", height: "100%", width: `${pct}%`, background: "#5FD0B0" }} /></span>
                  <span className="mono" style={{ fontSize: 10.5, color: "#A9BACB" }}>{p.stats.signed} / {p.stats.total} signed</span>
                </Link>
              );
            })}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, background: "#FFFFFF10" }}>
            <span style={{ width: 34, height: 34, borderRadius: "50%", background: "#E0A27A", color: "#142844", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>SA</span>
            <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>Super Admin</span><span className="mono" style={{ display: "block", fontSize: 10.5, color: "#A9BACB" }}>Exam office</span></span>
            <button type="button" aria-label="Sign out" onClick={signOut} style={{ color: "#C9D6E0", display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 9, background: "transparent", border: 0, cursor: "pointer" }}><Icon name="logout" /></button>
          </div>
        </aside>
        <main className="stage" style={{ flex: "999 1 560px", minWidth: 0, padding: "clamp(20px, 3vw, 40px)" }}>
          <div style={{ maxWidth: 1240, margin: "0 auto" }}>{children}</div>
        </main>
      </div>
    </Ctx.Provider>
  );
}
