import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import { siteConfig } from "../lib/site";

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  alternates: {
    canonical: "/"
  }
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Qelp",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: siteConfig.description,
  url: siteConfig.url
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Qelp?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Qelp is an AI-powered bug reporting and feedback platform that helps agencies and SaaS teams collect user issues, analyze them, and manage triage."
      }
    },
    {
      "@type": "Question",
      name: "Who is Qelp built for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Qelp is designed for agencies, SaaS product teams, product managers, engineering teams, and operations teams managing customer feedback across projects."
      }
    },
    {
      "@type": "Question",
      name: "How does Qelp improve bug reporting?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Qelp combines structured feedback capture, AI-generated summaries, severity scoring, probable causes, and suggested fixes in one workflow."
      }
    }
  ]
};

export default function LandingPage() {
  return (
    <main>
      <Script id="qelp-software-schema" type="application/ld+json">
        {JSON.stringify(softwareSchema)}
      </Script>
      <Script id="qelp-faq-schema" type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </Script>

      <section className="hero marketing-grid grid">
        <div className="marketing-copy">
          <p className="eyebrow">AI Feedback Triage for Agencies</p>
          <h1>Turn scattered user feedback into prioritized bugs, AI summaries, and action-ready issue triage.</h1>
          <p className="muted">
            Qelp helps agencies and SaaS teams capture feedback, route context, screenshots, voice notes, issue severity,
            and probable fixes from one central platform.
          </p>
          <div className="hero-actions">
            <Link className="cta" href="/login">Sign in to Qelp</Link>
            <Link className="cta secondary" href="/dashboard">View dashboard</Link>
          </div>
        </div>

        <aside className="panel marketing-highlight">
          <p className="muted">Why Qelp matters</p>
          <div className="mini-list">
            <div><strong>Capture better reports:</strong> feedback includes page, device, browser, and route context.</div>
            <div><strong>Triage faster:</strong> AI generates summaries, severity, and probable causes.</div>
            <div><strong>Manage many clients:</strong> agencies can handle multiple projects in one workspace.</div>
            <div><strong>Reduce support noise:</strong> turn vague complaints into structured engineering work.</div>
          </div>
        </aside>
      </section>

      <section className="grid feature-grid">
        <article className="panel feature-card">
          <h3>Smart bug reporting</h3>
          <p className="muted">Collect user feedback with project context, environment data, and structured intake fields.</p>
        </article>
        <article className="panel feature-card">
          <h3>AI bug analysis</h3>
          <p className="muted">Generate titles, summaries, categories, severity levels, and probable causes automatically.</p>
        </article>
        <article className="panel feature-card">
          <h3>Feedback prioritization</h3>
          <p className="muted">Surface urgent issues first with AI-assisted scoring and cleaner operational triage.</p>
        </article>
        <article className="panel feature-card">
          <h3>Agency dashboard</h3>
          <p className="muted">Track multiple client products, assign issues, and manage the full feedback workflow.</p>
        </article>
      </section>

      <section className="hero" style={{ marginTop: 32 }}>
        <p className="eyebrow">Who should use Qelp</p>
        <h2 className="page-title">Built for agencies, SaaS teams, product managers, engineering leads, and support operators.</h2>
        <p className="muted">
          If your team spends time translating messy customer feedback into engineering tasks, Qelp gives you a more
          structured way to capture, enrich, and resolve product issues.
        </p>
      </section>

      <section className="grid faq-grid">
        <article className="panel faq-card">
          <h3>What problems does Qelp solve?</h3>
          <p className="muted">Qelp reduces unclear bug reports, slow issue analysis, and inconsistent prioritization across products and client accounts.</p>
        </article>
        <article className="panel faq-card">
          <h3>Does Qelp support agencies with multiple clients?</h3>
          <p className="muted">Yes. Qelp is built around workspace and project organization so one agency can manage multiple client products in one system.</p>
        </article>
        <article className="panel faq-card">
          <h3>Is Qelp a replacement for human triage?</h3>
          <p className="muted">No. Qelp uses assistive AI to speed up analysis while keeping final triage decisions with your team.</p>
        </article>
      </section>
    </main>
  );
}
