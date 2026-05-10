"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ClientProject } from "@qelp/shared/contracts";

interface ProjectsManagerProps {
  workspaceId: string;
  initialProjects: ClientProject[];
  canEdit: boolean;
  canDelete: boolean;
}

export function ProjectsManager({
  workspaceId,
  initialProjects,
  canEdit,
  canDelete,
}: ProjectsManagerProps) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function createProject() {
    if (!canEdit) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, clientName, description }),
      });
      if (!response.ok) throw new Error("Failed to create");
      const data = (await response.json()) as { item: ClientProject };
      setProjects((prev) => [...prev, data.item]);
      setName("");
      setClientName("");
      setDescription("");
      setMessage("Project created.");
      router.refresh();
    } catch {
      setMessage("Create failed. Check API and permissions.");
    } finally {
      setBusy(false);
    }
  }

  async function rotateToken(projectId: string) {
    if (!canEdit) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects/${projectId}/rotate-token`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to rotate");
      const data = (await response.json()) as { item: ClientProject };
      setProjects((prev) => prev.map((p) => (p.id === projectId ? data.item : p)));
      setMessage(`Token rotated. New token shown below the project.`);
    } catch {
      setMessage("Rotate failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject(projectId: string) {
    if (!canDelete) return;
    if (!confirm("Delete this project? Feedback and attachments will also be deleted.")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setMessage("Project deleted.");
      router.refresh();
    } catch {
      setMessage("Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid layout" style={{ marginTop: 24 }}>
      <article className="panel">
        <p className="muted">Existing projects</p>
        <div className="list" style={{ marginTop: 12 }}>
          {projects.length === 0 ? <p className="muted">No projects yet.</p> : null}
          {projects.map((project) => (
            <div key={project.id} className="feedback-card">
              <p className="muted">{project.clientName}</p>
              <h3>{project.name}</h3>
              <p className="muted">{project.description}</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>
                <strong>Widget token:</strong>{" "}
                <code style={{ background: "#efe4d6", padding: "2px 6px", borderRadius: 4 }}>
                  {project.widgetToken}
                </code>
              </p>
              <div className="action-row" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="cta secondary"
                  disabled={!canEdit || busy}
                  onClick={() => void rotateToken(project.id)}
                >
                  Rotate token
                </button>
                <button
                  type="button"
                  className="cta secondary"
                  disabled={!canDelete || busy}
                  onClick={() => void deleteProject(project.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <p className="muted">Add a project</p>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="field">
            <span>Project name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} disabled={!canEdit} />
          </label>
          <label className="field">
            <span>Client name</span>
            <input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              disabled={!canEdit}
            />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={!canEdit}
            />
          </label>
        </div>
        <div className="action-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="cta"
            disabled={!canEdit || busy || !name || !clientName}
            onClick={() => void createProject()}
          >
            {busy ? "Saving..." : "Create project"}
          </button>
          <p className="muted inline-note">{message}</p>
        </div>
      </article>
    </section>
  );
}
