import { LoginForm } from "./login-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to the protected Qelp admin workspace.",
  robots: {
    index: false,
    follow: false
  }
};

export default function LoginPage() {
  return (
    <main>
      <section className="hero">
        <p className="muted">Qelp Admin</p>
        <h1>Sign in to manage agency feedback and client project triage.</h1>
      </section>
      <LoginForm />
    </main>
  );
}
