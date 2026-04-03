import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAgencyDashboardData } from "../../lib/api";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Protected Qelp dashboard for agency feedback triage and project management.",
  robots: {
    index: false,
    follow: false
  }
};

export default async function DashboardPage() {
  const { workspace, projects, items, summary, usingFallback, authenticated } = await getAgencyDashboardData();
  if (!authenticated) redirect("/login");
  const topItems = items.slice(0, 4);

  return (
    <main>
      <section className="hero">
        <p className="muted">Agency workspace / {workspace.name}</p>
        <h1>One inbox for every client product, with AI signal before your team spends time triaging.</h1>
        <p className="muted">
          Qelp centralizes customer feedback, screenshots, voice notes, emotion analysis, and assistive bug-fix suggestions
          across every client project your agency manages.
        </p>
        {usingFallback ? (
          <p className="notice">
            Dashboard is showing seed data because the API is not currently reachable at {process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}.
          </p>
        ) : null}
      </section>

      <section className="grid stats">
        <article className="panel"><span className="muted">Open issues</span><strong>{summary.openCount}</strong></article>
        <article className="panel"><span className="muted">Urgent items</span><strong>{summary.urgentCount}</strong></article>
        <article className="panel"><span className="muted">Avg. confidence</span><strong>{summary.averageConfidence}%</strong></article>
        <article className="panel"><span className="muted">Negative sentiment</span><strong>{summary.negativeEmotionCount}</strong></article>
      </section>

      <section className="grid layout">
        <div className="panel">
          <p className="muted">Priority inbox</p>
          <div className="list">
            {topItems.map((item) => (
              <Link key={item.id} className="feedback-card" href={`/projects/${item.projectId}/feedback/${item.id}`}>
                <div className="badge-row">
                  <span className={`badge ${item.priority.label === "urgent" ? "urgent" : ""}`}>{item.priority.label}</span>
                  {item.labels.map((label) => <span key={label} className="badge">{label}</span>)}
                  <span className="badge">{item.aiAnalysis?.emotion.secondary ?? item.aiAnalysis?.emotion.primary ?? "unknown"}</span>
                </div>
                <h3>{item.aiAnalysis?.title ?? "Untitled feedback"}</h3>
                <p className="muted">{item.aiAnalysis?.summary ?? item.content.message}</p>
              </Link>
            ))}
          </div>
        </div>

        <aside className="panel">
          <p className="muted">Client projects</p>
          <div className="list">
            {projects.map((project) => (
              <div key={project.id} className="feedback-card">
                <p className="muted">{project.clientName}</p>
                <h3>{project.name}</h3>
                <p className="muted">{project.description}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
