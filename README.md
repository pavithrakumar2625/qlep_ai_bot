# Qelp

AI-first feedback and bug triage platform for agencies managing multiple client products. End users submit feedback through an embeddable widget (text, screenshot, voice); the API persists, transcribes, and AI-classifies it; the agency triages from a Next.js dashboard.

## Workspace layout

- `apps/api` — Express 4 + Postgres 16 (Drizzle ORM) + Zod. Auth, feedback intake, uploads, AI/STT triage, analytics.
- `apps/admin` — Next.js 15 App Router. Landing, login, dashboard with charts + filters, feedback detail, settings (projects + users). Same-origin BFF route handlers proxy to the API; the auth cookie is HttpOnly.
- `packages/shared` — Source-only TS package with domain contracts, mock seed data, and `scorePriority` / `getDashboardSummary` helpers. No build step; consumers transpile it directly.
- `packages/widget` — Vanilla TS widget bundled to a single IIFE via esbuild. Captures DOM screenshots (`html2canvas`), voice (`MediaRecorder`), uploads attachments, and submits feedback.

## Quick start

Requires Node 20+ and Docker (for Postgres).

```bash
npm install
cp .env.example .env

# start Postgres
npm run db:up --workspace @qelp/api

# apply migrations and load seed data
npm run db:migrate --workspace @qelp/api
npm run db:seed --workspace @qelp/api

# run the API + admin in two terminals
npm run dev:api
npm run dev:admin

# (optional) bundle the widget for the demo page
npm run build --workspace @qelp/widget
```

Default seed login: `ana@northstar.test` / `Password123!`.

Local URLs:
- Admin dashboard: <http://localhost:3000>
- API: <http://localhost:4000>
- Widget demo: open `packages/widget/demo/index.html` in a browser

## Scripts cheat sheet

Run from the repo root.

| Script | Description |
| --- | --- |
| `npm run dev:api` | `tsx watch` on `apps/api/src/server.ts` |
| `npm run dev:admin` | `next dev` for the dashboard |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | Typecheck api + admin + widget |
| `npm run lint` | ESLint across the repo |
| `npm run format` / `format:check` | Prettier write/check |
| `npm run test` | Vitest across workspaces |
| `npm run db:up --workspace @qelp/api` | Start the Postgres docker service |
| `npm run db:migrate --workspace @qelp/api` | Apply Drizzle migrations |
| `npm run db:seed --workspace @qelp/api` | Upsert mock seed data |
| `npm run db:reset --workspace @qelp/api` | Wipe the volume and re-init |
| `npm run db:generate --workspace @qelp/api` | Generate a new Drizzle migration from schema.ts |
| `npm run build --workspace @qelp/widget` | Bundle widget to `dist/qelp-widget.js` |

## Environment

`.env.example` documents the surface. `apps/api/src/config/env.ts` loads `./.env` and `../../.env`. Strict checks run only when `NODE_ENV=production` (rejects the default `AUTH_SECRET` and enforces a 32-character minimum).

Notable variables:
- `DATABASE_URL` — Postgres connection string.
- `AUTH_SECRET` — HMAC signing key for the auth token. Required (32+ chars) in production.
- `ADMIN_ORIGIN` — admin URL allowed by CORS for `/auth`, `/workspaces`, etc.
- `OPENAI_API_KEY` / `GROQ_API_KEY` / `AI_PROVIDER` — AI triage. Without keys, the deterministic rule-based fallback runs.
- `STT_PROVIDER` (`openai` / `groq` / `none`) + `STT_MODEL` — speech-to-text for voice attachments.
- `STORAGE_PROVIDER` (`local`) + `STORAGE_LOCAL_DIR` — attachment storage. Local-disk only today; the `StorageProvider` interface is set up for an S3 swap.
- `RATE_LIMIT_FEEDBACK_PER_MIN` / `RATE_LIMIT_LOGIN_PER_MIN` — abuse protection for public endpoints.

## Architecture notes

- **Auth.** Login (`POST /auth/login`) issues an HMAC-signed token. The admin's BFF route handler at `/api/auth/login` forwards the request to the API and sets the token as an `HttpOnly`, `SameSite=Lax`, `Secure`-in-prod cookie. Browser → admin BFF → API; the browser never holds the token in JS-readable form. Bearer auth is reserved for direct API consumers (curl, the widget upload endpoint, and the BFF itself).
- **Tenancy.** Every workspace-scoped route compares `request.params.workspaceId` against `request.authUser.workspaceId` and returns 403 on mismatch. Cross-workspace `assignedTo` is rejected on PATCH `/feedback/:id`.
- **Public widget endpoints.** `POST /feedback` and `POST /uploads` are CORS-open and gated by the project's `widget_token` (matched against `client_projects.widget_token`). They are rate-limited per `(IP, project key)`.
- **Async triage.** `POST /feedback` returns 201 immediately. A `setImmediate` dispatcher runs `runTriage(feedbackId)` which optionally transcribes audio attachments via Whisper, then runs the AI provider (with `AbortSignal.timeout` and message truncation). The `feedback_items.triage_status` enum tracks `pending | completed | failed`.
- **Storage abstraction.** `StorageProvider` interface (`apps/api/src/services/storage/types.ts`) with a `LocalFsStorageProvider` writing under `apps/api/storage/{workspaceId}/{projectId}/{attachmentId}.{ext}`. Swap to S3 by adding a new provider behind `STORAGE_PROVIDER`.
- **Health.** `GET /health` runs `SELECT 1` with a 1.5s timeout; 200 ok / 503 degraded.
- **Logging.** `pino` + `pino-http` with redaction for `Authorization`, `Cookie`, `password`, and `x-qelp-project-key`.
- **Database.** Drizzle ORM with `postgres.js` driver. Schema lives in `apps/api/src/db/schema.ts`. Migrations are generated with `drizzle-kit` and applied via `migrations/` + `drizzle-orm/postgres-js/migrator`.

## Production deployment notes

This repo ships a portfolio-grade implementation. To run it on the public internet, you would still want to:

- **Async work queue.** The triage dispatcher is in-process (`setImmediate`). On a server restart, in-flight triage is lost. Replace with BullMQ, Sidekiq-on-Postgres, or any durable job queue.
- **Real storage.** Implement an `S3StorageProvider` (the interface is ready) and serve attachments via signed URLs instead of streaming through the API.
- **Secrets.** `AUTH_SECRET` must be generated per-environment and stored in your secret manager. The default value is rejected when `NODE_ENV=production`.
- **Schema search index.** Search uses ILIKE today. For larger datasets add a `tsvector` GIN index migration.
- **Email + invites.** User creation uses an admin-set initial password. A real product wants an email-based invite flow.
- **Observability.** pino logs are JSON in prod. Pipe to your log sink + add request IDs upstream if your load balancer doesn't already.

## Tests

`npm run test` runs Vitest in `apps/api`. Today's coverage:

- `passwords` hash + verify
- `authTokens` round-trip + tampered + malformed
- `LocalFsStorageProvider` put/get/delete + traversal protection
- `aiTriager` deterministic fallback path

Repository-level integration tests against ephemeral Postgres are intentionally deferred. The CI workflow provisions a Postgres service container so they slot in cleanly when added.

## Documentation

- [`product_brief.md`](product_brief.md) — product overview and architecture summary
- [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) — detailed implementation notes for the platform tiers branch
- [`CLAUDE.md`](CLAUDE.md) — developer guide for agents and contributors working in this repo

## License

[MIT](LICENSE)
