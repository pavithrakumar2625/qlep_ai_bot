# Qelp — product brief

**Tagline:** Transforming user feedback into intelligent solutions.

## Overview

Qelp is an AI-first feedback and bug triage platform for agencies and freelancers managing multiple client products. End users submit feedback through an embeddable browser widget; the API persists, transcribes, and classifies submissions; agency staff triage and collaborate from a Next.js admin dashboard.

## Problem

Traditional feedback tools collect reports but leave agencies to manually interpret vague messages, prioritize across clients, and route work. That slows response time and makes multi-project portfolios hard to manage.

## Solution

Qelp combines a lightweight embeddable widget with async AI triage (title, labels, priority, sentiment) and an agency dashboard for filtering, analytics, assignment, and threaded comments.

## Key capabilities

1. **Embeddable widget** — text, screenshot capture, and voice notes with attachment upload.
2. **AI triage** — OpenAI/Groq with deterministic fallback; optional Whisper STT for audio.
3. **Agency dashboard** — portfolio inbox, KPI charts, filters, feedback detail, triage controls.
4. **Multi-tenant workspaces** — projects, users, roles (`owner` / `manager` / `member`), widget tokens.
5. **Secure intake** — public `POST /feedback` and `POST /uploads` gated by project widget token + rate limits.

## Architecture

| Layer | Stack |
| --- | --- |
| Widget | Vanilla TypeScript, esbuild IIFE, html2canvas, MediaRecorder |
| API | Express 4, Postgres 16, Drizzle ORM, Zod |
| Admin | Next.js 15 App Router, same-origin BFF for auth |
| Shared | `@qelp/shared` contracts and seed data |

## Workflow

User submits feedback via widget → API stores row + attachments → async triage (STT → AI) → agency reviews in dashboard → status, assignment, and comments updated.

## Repository layout

- `apps/api` — REST API, migrations, triage pipeline, storage
- `apps/admin` — dashboard and BFF route handlers
- `packages/shared` — domain types and mock seed data
- `packages/widget` — embeddable client widget
- `docs/IMPLEMENTATION.md` — detailed implementation notes for the platform tiers work

## Future enhancements

Durable job queue for triage, S3-backed storage, GitHub/issue-tracker integration, email invites, full-text search index, mobile SDK.
