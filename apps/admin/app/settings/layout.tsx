import Link from "next/link";
import type { ReactNode } from "react";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <main>
      <Link className="muted" href="/dashboard">
        Back to dashboard
      </Link>
      <section className="hero" style={{ marginTop: 16 }}>
        <p className="muted">Workspace settings</p>
        <nav style={{ display: "flex", gap: 16, marginTop: 12 }}>
          <Link href="/settings/projects">Projects</Link>
          <Link href="/settings/users">Users</Link>
        </nav>
      </section>
      {children}
    </main>
  );
}
