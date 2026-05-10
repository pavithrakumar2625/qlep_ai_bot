"use client";

import { useEffect, useState } from "react";
import type { Comment, User } from "@qelp/shared/contracts";

interface CommentsThreadProps {
  feedbackId: string;
  initialComments: Comment[];
  users: User[];
  currentUserId: string | null;
  disabled?: boolean;
}

export function CommentsThread({
  feedbackId,
  initialComments,
  users,
  currentUserId,
  disabled = false,
}: CommentsThreadProps) {
  const [items, setItems] = useState<Comment[]>(initialComments);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setItems(initialComments);
  }, [initialComments]);

  function authorName(authorId: string) {
    return users.find((u) => u.id === authorId)?.name ?? "Unknown";
  }

  async function submit() {
    if (disabled || draft.trim().length === 0) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/feedback/${feedbackId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      if (!response.ok) throw new Error("Failed to post");
      const data = (await response.json()) as { item: Comment };
      setItems((prev) => [...prev, data.item]);
      setDraft("");
    } catch {
      setMessage("Failed to post comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel">
      <p className="muted">Discussion</p>
      <div className="list" style={{ marginTop: 12 }}>
        {items.length === 0 ? (
          <p className="muted">No comments yet.</p>
        ) : (
          items.map((comment) => (
            <div key={comment.id} className="feedback-card">
              <p className="muted" style={{ fontSize: 13 }}>
                {authorName(comment.authorId)} · {new Date(comment.createdAt).toLocaleString()}
              </p>
              <p>{comment.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="form-grid" style={{ marginTop: 16 }}>
        <label className="field">
          <span>Add a comment</span>
          <textarea
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={disabled || busy || !currentUserId}
            placeholder={
              disabled
                ? "API unavailable. Comments are read-only while fallback data is shown."
                : "Share an update for the team"
            }
          />
        </label>
      </div>
      <div className="action-row">
        <button
          type="button"
          className="cta"
          disabled={disabled || busy || !currentUserId || draft.trim().length === 0}
          onClick={() => void submit()}
        >
          {busy ? "Posting..." : "Post comment"}
        </button>
        <p className="muted inline-note">{message}</p>
      </div>
    </article>
  );
}
