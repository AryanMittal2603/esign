"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand, Icon, api } from "@/components/ui";
import { Guilloche } from "./Guilloche";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  const signOut = async () => { await api("/api/admin/logout", { method: "POST" }); router.replace("/admin/login"); };
  const navStyle = (on: boolean) => (on ? { background: "#FFFFFF1A", color: "#FFFFFF" } : undefined);

  return (
    <div className="shell">
      <aside style={{ flex: "1 1 232px", minWidth: 0, background: "linear-gradient(180deg,#142844 0%,#0F1E35 100%)", color: "#fff", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 28, position: "relative", overflow: "hidden" }}>
        <Guilloche lines={10} opacity={0.06} width={240} height={260} style={{ top: "auto", bottom: 70, height: 260 }} />
        <Link href="/admin" style={{ padding: "0 8px", textDecoration: "none" }}><Brand size={18} light /></Link>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }} aria-label="Main">
          <Link className="nav" href="/admin" style={navStyle(path === "/admin")} aria-current={path === "/admin" ? "page" : undefined}><Icon name="grid" /> Overview</Link>
          <Link className="nav" href="/admin/exams" style={navStyle(path.startsWith("/admin/exams"))} aria-current={path.startsWith("/admin/exams") ? "page" : undefined}><Icon name="folder" /> Exams</Link>
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, background: "#FFFFFF10", position: "relative", backdropFilter: "blur(6px)" }}>
          <span style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#CB8A60,#A65B30)", color: "#FFFFFF", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>SA</span>
          <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>Super Admin</span><span className="mono" style={{ display: "block", fontSize: 10.5, color: "#A9BACB" }}>Exam office</span></span>
          <button type="button" aria-label="Sign out" onClick={signOut} style={{ color: "#C9D6E0", display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 9, background: "transparent", border: 0, cursor: "pointer" }}><Icon name="logout" /></button>
        </div>
      </aside>
      <main className="admin-main" style={{ flex: "999 1 560px", minWidth: 0, padding: "clamp(20px, 3vw, 40px)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>{children}</div>
      </main>
    </div>
  );
}
