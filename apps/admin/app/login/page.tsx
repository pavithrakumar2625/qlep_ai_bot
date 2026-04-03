import { LoginForm } from "./login-form";

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
