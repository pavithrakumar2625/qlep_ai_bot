"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FeedbackStatus, User } from "@qelp/shared/contracts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const statusOptions: FeedbackStatus[] = ["new", "triaged", "in_progress", "resolved", "archived"];

function getTokenFromCookie() {
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("qelp_token="));
  return match ? decodeURIComponent(match.slice("qelp_token=".length)) : null;
}

interface TriageControlsProps {
  feedbackId: string;
  initialStatus: FeedbackStatus;
  initialAssignedTo: string | null;
  initialLabels: string[];
  users: User[];
  disabled?: boolean;
}

export function TriageControls({
  feedbackId,
  initialStatus,
  initialAssignedTo,
  initialLabels,
  users,
  disabled = false
}: TriageControlsProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [assignedTo, setAssignedTo] = useState(initialAssignedTo ?? "");
  const [labels, setLabels] = useState(initialLabels.join(", "));
  const [message, setMessage] = useState(disabled ? "API unavailable. Controls are read-only while fallback data is shown." : "");
  const [isSaving, setIsSaving] = useState(false);

  async function saveTriage() {
    if (disabled) return;

    setIsSaving(true);
    setMessage("Saving triage changes...");

    try {
      const response = await fetch(`${API_BASE_URL}/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(getTokenFromCookie() ? { Authorization: `Bearer ${getTokenFromCookie()}` } : {})
        },
        body: JSON.stringify({
          status,
          assignedTo: assignedTo || null,
          labels: labels.split(",").map((item) => item.trim()).filter(Boolean)
        })
      });

      if (!response.ok) throw new Error("Failed to update feedback");
      setMessage("Saved.");
      router.refresh();
    } catch {
      setMessage("Save failed. Check API connectivity and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="panel">
      <p className="muted">Triage controls</p>
      <div className="form-grid">
        <label className="field">
          <span>Status</span>
          <select value={status} disabled={disabled || isSaving} onChange={(event) => setStatus(event.target.value as FeedbackStatus)}>
            {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Assign owner</span>
          <select value={assignedTo} disabled={disabled || isSaving} onChange={(event) => setAssignedTo(event.target.value)}>
            <option value="">Unassigned</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Labels</span>
          <input
            type="text"
            value={labels}
            disabled={disabled || isSaving}
            onChange={(event) => setLabels(event.target.value)}
            placeholder="authentication, urgent"
          />
        </label>
      </div>
      <div className="action-row">
        <button type="button" className="cta" disabled={disabled || isSaving} onClick={() => void saveTriage()}>
          {isSaving ? "Saving..." : "Save changes"}
        </button>
        <p className="muted inline-note">{message}</p>
      </div>
    </article>
  );
}
