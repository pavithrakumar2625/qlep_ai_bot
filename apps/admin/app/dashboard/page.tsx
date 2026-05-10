import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAgencyDashboardData, type DashboardFilters } from "../../lib/api";
import { AnalyticsCharts } from "./charts";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Protected Qelp dashboard for agency feedback triage and project management.",
  robots: {
    index: false,
    follow: false,
  },
};

const STATUSES = ["new", "triaged", "in_progress", "resolved", "archived"] as const;
const PRIORITIES = ["urgent", "high", "medium", "low"] as const;

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const filters: DashboardFilters = {
    status: pickString(params.status),
    projectId: pickString(params.projectId),
    priorityLabel: pickString(params.priorityLabel),
    q: pickString(params.q),
    cursor: pickString(params.cursor),
  };

  const { workspace, projects, items, nextCursor, summary, analytics, usingFallback, authenticated } =
    await getAgencyDashboardData(filters);
  if (!authenticated) redirect("/login");

  function buildHref(overrides: Partial<DashboardFilters>) {
    const merged = { ...filters, ...overrides };
    const qs = new URLSearchParams();
    if (merged.status) qs.set("status", merged.status);
    if (merged.projectId) qs.set("projectId", merged.projectId);
    if (merged.priorityLabel) qs.set("priorityLabel", merged.priorityLabel);
    if (merged.q) qs.set("q", merged.q);
    if (overrides.cursor !== undefined) {
      if (overrides.cursor) qs.set("cursor", overrides.cursor);
    } else if (merged.cursor) {
      qs.set("cursor", merged.cursor);
    }
    const query = qs.toString();
    return query ? `/dashboard?${query}` : "/dashboard";
  }

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
            Dashboard is showing seed data because the API is not currently reachable at{" "}
            {process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}.
          </p>
        ) : null}
      </section>

      <section className="grid stats">
        <article className="panel"><span className="muted">Open issues</span><strong>{summary.openCount}</strong></article>
        <article className="panel"><span className="muted">Urgent items</span><strong>{summary.urgentCount}</strong></article>
        <article className="panel"><span className="muted">Avg. confidence</span><strong>{summary.averageConfidence}%</strong></article>
        <article className="panel"><span className="muted">Negative sentiment</span><strong>{summary.negativeEmotionCount}</strong></article>
      </section>

      {analytics ? <AnalyticsCharts analytics={analytics} /> : null}

      <section className="panel" style={{ marginTop: 24 }}>
        <p className="muted">Filter inbox</p>
        <form method="GET" action="/dashboard" className="form-grid" style={{ marginTop: 12 }}>
          <label className="field">
            <span>Search</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Find feedback by keyword"
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">Any</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Priority</span>
            <select name="priorityLabel" defaultValue={filters.priorityLabel ?? ""}>
              <option value="">Any</option>
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Project</span>
            <select name="projectId" defaultValue={filters.projectId ?? ""}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
        </form>
        <div className="action-row" style={{ marginTop: 12 }}>
          <button form="" type="submit" className="cta" formAction="/dashboard" formMethod="get">Apply filters</button>
          <Link className="muted inline-note" href="/dashboard">Reset</Link>
        </div>
      </section>

      <section className="grid layout" style={{ marginTop: 24 }}>
        <div className="panel">
          <p className="muted">Inbox ({items.length} shown)</p>
          <div className="list">
            {items.length === 0 ? (
              <p className="muted">No feedback matches the current filters.</p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  className="feedback-card"
                  href={`/projects/${item.projectId}/feedback/${item.id}`}
                >
                  <div className="badge-row">
                    <span className={`badge ${item.priority.label === "urgent" ? "urgent" : ""}`}>{item.priority.label}</span>
                    <span className="badge">{item.status}</span>
                    {item.labels.map((label) => <span key={label} className="badge">{label}</span>)}
                    <span className="badge">{item.aiAnalysis?.emotion.secondary ?? item.aiAnalysis?.emotion.primary ?? "unknown"}</span>
                  </div>
                  <h3>{item.aiAnalysis?.title ?? "Untitled feedback"}</h3>
                  <p className="muted">{item.aiAnalysis?.summary ?? item.content.message}</p>
                </Link>
              ))
            )}
          </div>
          {nextCursor ? (
            <div className="action-row" style={{ marginTop: 16 }}>
              <Link className="cta" href={buildHref({ cursor: nextCursor })}>Load more</Link>
            </div>
          ) : null}
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
