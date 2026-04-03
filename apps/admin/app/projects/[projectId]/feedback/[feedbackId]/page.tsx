import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { getFeedbackDetailData } from "../../../../../lib/api";
import { TriageControls } from "./triage-controls";

interface PageProps {
  params: Promise<{
    projectId: string;
    feedbackId: string;
  }>;
}

export default async function FeedbackDetailPage({ params }: PageProps) {
  const { projectId, feedbackId } = await params;
  const data = await getFeedbackDetailData(projectId, feedbackId);
  if (data && !data.authenticated) redirect("/login");
  if (!data) notFound();

  const { workspace, project, feedback, users, owner, usingFallback } = data;

  return (
    <main>
      <Link className="muted" href="/">Back to dashboard</Link>
      <section className="hero" style={{ marginTop: 16 }}>
        <p className="muted">{workspace.name} / {project.clientName} / {project.name}</p>
        <h1 className="page-title">{feedback.aiAnalysis?.title ?? "Feedback detail"}</h1>
        <div className="badge-row">
          <span className={`badge ${feedback.priority.label === "urgent" ? "urgent" : ""}`}>{feedback.priority.label}</span>
          <span className="badge">{feedback.status}</span>
          {feedback.labels.map((label) => <span key={label} className="badge">{label}</span>)}
        </div>
        {usingFallback ? <p className="notice">Detail view is using seed data because the API is unavailable.</p> : null}
      </section>

      <section className="detail-grid">
        <article className="panel">
          <p className="muted">Customer report</p>
          <p>{feedback.content.message}</p>
          <div className="meta-list" style={{ marginTop: 24 }}>
            <div className="meta-row"><span>Reporter</span><strong>{feedback.reporter.email ?? feedback.reporter.name ?? "anonymous"}</strong></div>
            <div className="meta-row"><span>Route</span><strong>{feedback.environment.route ?? "unknown"}</strong></div>
            <div className="meta-row"><span>Browser</span><strong>{feedback.environment.browser ?? "unknown"}</strong></div>
            <div className="meta-row"><span>Assigned to</span><strong>{owner?.name ?? "unassigned"}</strong></div>
          </div>
          <p className="muted" style={{ marginTop: 18 }}>Voice transcript</p>
          <p>{feedback.voiceTranscript?.transcript ?? "No voice note attached."}</p>
        </article>

        <aside className="grid">
          <TriageControls
            feedbackId={feedback.id}
            initialStatus={feedback.status}
            initialAssignedTo={feedback.assignedTo}
            initialLabels={feedback.labels}
            users={users}
            disabled={usingFallback}
          />
          <article className="panel">
            <p className="muted">AI analysis</p>
            <p>{feedback.aiAnalysis?.summary}</p>
            <div className="meta-list" style={{ marginTop: 24 }}>
              <div className="meta-row"><span>Category</span><strong>{feedback.aiAnalysis?.category}</strong></div>
              <div className="meta-row"><span>Emotion</span><strong>{feedback.aiAnalysis?.emotion.secondary ?? feedback.aiAnalysis?.emotion.primary}</strong></div>
              <div className="meta-row"><span>Confidence</span><strong>{Math.round((feedback.aiAnalysis?.confidence ?? 0) * 100)}%</strong></div>
            </div>
          </article>
          <article className="panel">
            <p className="muted">Probable cause</p>
            <p>{feedback.aiAnalysis?.probableCause}</p>
            <p className="muted" style={{ marginTop: 18 }}>Suggested fix</p>
            <p>{feedback.aiAnalysis?.suggestedFix}</p>
          </article>
        </aside>
      </section>
    </main>
  );
}
