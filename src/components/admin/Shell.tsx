"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand, Icon, api } from "@/components/ui";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  const signOut = async () => { await api("/api/admin/logout", { method: "POST" }); router.replace("/admin/login"); };
  const navStyle = (on: boolean) => (on ? { background: "#FFFFFF1A", color: "#FFFFFF" } : undefined);

  return (
    <div className="shell">
      <aside style={{ flex: "1 1 232px", minWidth: 0, background: "#142844", color: "#fff", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 28 }}>
        <Link href="/admin" style={{ padding: "0 8px", textDecoration: "none" }}><Brand size={18} light /></Link>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }} aria-label="Main">
          <Link className="nav" href="/admin" style={navStyle(path === "/admin")} aria-current={path === "/admin" ? "page" : undefined}><Icon name="grid" /> Overview</Link>
          <Link className="nav" href="/admin/exams" style={navStyle(path.startsWith("/admin/exams"))} aria-current={path.startsWith("/admin/exams") ? "page" : undefined}><Icon name="folder" /> Exams</Link>
        </nav>
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
  );
}
