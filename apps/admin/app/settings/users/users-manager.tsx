"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { User, WorkspaceRole } from "@qelp/shared/contracts";

const ROLES: WorkspaceRole[] = ["owner", "manager", "contributor", "client_viewer"];

interface UsersManagerProps {
  workspaceId: string;
  initialUsers: User[];
  canManage: boolean;
}

export function UsersManager({ workspaceId, initialUsers, canManage }: UsersManagerProps) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("contributor");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function createUser() {
    if (!canManage) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role, password }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to create");
      }
      const data = (await response.json()) as { item: User };
      setUsers((prev) => [...prev, data.item]);
      setEmail("");
      setName("");
      setPassword("");
      setRole("contributor");
      setMessage("User created. Share the password with them out-of-band.");
      router.refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Create failed";
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, nextRole: WorkspaceRole) {
    if (!canManage) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to update");
      }
      const data = (await response.json()) as { item: User };
      setUsers((prev) => prev.map((u) => (u.id === userId ? data.item : u)));
      setMessage("Role updated.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Update failed";
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(userId: string) {
    if (!canManage) return;
    if (!confirm("Remove this user from the workspace?")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/users/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to delete");
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setMessage("User removed.");
      router.refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Delete failed";
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid layout" style={{ marginTop: 24 }}>
      <article className="panel">
        <p className="muted">Workspace members</p>
        <div className="list" style={{ marginTop: 12 }}>
          {users.map((user) => (
            <div key={user.id} className="feedback-card">
              <p className="muted">{user.email}</p>
              <h3>{user.name}</h3>
              <div className="action-row" style={{ marginTop: 8 }}>
                <select
                  value={user.role}
                  disabled={!canManage || busy}
                  onChange={(event) => void changeRole(user.id, event.target.value as WorkspaceRole)}
                >
                  {ROLES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="cta secondary"
                  disabled={!canManage || busy}
                  onClick={() => void deleteUser(user.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <p className="muted">Invite a teammate</p>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={!canManage}
            />
          </label>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} disabled={!canManage} />
          </label>
          <label className="field">
            <span>Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as WorkspaceRole)}
              disabled={!canManage}
            >
              {ROLES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Initial password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={!canManage}
            />
          </label>
        </div>
        <div className="action-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="cta"
            disabled={!canManage || busy || !email || !name || password.length < 8}
            onClick={() => void createUser()}
          >
            {busy ? "Saving..." : "Create user"}
          </button>
          <p className="muted inline-note">{message}</p>
        </div>
      </article>
    </section>
  );
}
