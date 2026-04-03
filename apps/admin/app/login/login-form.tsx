"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setIsSubmitting(true);
    setMessage("Signing in...");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) throw new Error("Invalid credentials");
      const data = await response.json() as { token: string };
      document.cookie = `qelp_token=${encodeURIComponent(data.token)}; path=/; max-age=${60 * 60 * 12}; samesite=lax`;
      setMessage("Signed in.");
      router.push("/");
      router.refresh();
    } catch {
      setMessage("Sign-in failed. Check credentials and API connectivity.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="panel" style={{ maxWidth: 420 }}>
      <p className="muted">Agency sign in</p>
      <div className="form-grid">
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
      </div>
      <div className="action-row">
        <button type="button" className="cta" disabled={isSubmitting} onClick={() => void submit()}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
        <p className="muted inline-note">{message || "Use your agency login to access the workspace."}</p>
      </div>
    </article>
  );
}
