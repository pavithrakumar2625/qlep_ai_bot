# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from the repo root unless noted. Node >= 20 required, Docker for Postgres.

- `npm install` — installs all workspaces.
- `npm run db:up --workspace @qelp/api` — start Postgres via docker compose.
- `npm run db:migrate --workspace @qelp/api` — apply Drizzle migrations under `apps/api/migrations/`.
- `npm run db:seed --workspace @qelp/api` — upsert mock seed data from `@qelp/shared/contracts`.
- `npm run db:reset --workspace @qelp/api` — wipe volume and re-init.
- `npm run db:generate --workspace @qelp/api` — diff `apps/api/src/db/schema.ts` against migrations and emit a new SQL file. Run after schema edits.
- `npm run dev:api` — `tsx watch` on `apps/api/src/server.ts` (port 4000).
- `npm run dev:admin` — `next dev` for the admin dashboard (port 3000).
- `npm run typecheck` — typechecks api + admin + widget.
- `npm run lint` — ESLint flat-config across the repo.
- `npm run format` / `format:check` — Prettier.
- `npm run test --workspace @qelp/api` — Vitest. Forced single-threaded (`--pool threads --poolOptions.threads.singleThread`) because tests touch shared module state. Run a single test with `npm run test --workspace @qelp/api -- aiTriager` or `... -- -t "round-trips"`.
- `npm run build --workspace @qelp/widget` — bundles widget to `dist/qelp-widget.js` via esbuild (IIFE).
- Seed login: any user from `mockUsers` (e.g. `ana@northstar.test`) with password `Password123!`.

## Architecture

npm-workspaces monorepo. Four packages:

- `apps/api` — Express 4 + Postgres 16 (`postgres` driver via Drizzle ORM) + Zod. Node ESM (`"type": "module"`). Entry `src/server.ts` → `createApp()` mounts `/health`, `/auth`, `/workspaces`, `/feedback`, `/uploads`.
- `apps/admin` — Next.js 15 App Router (React 19). Server components fetch the API; client components handle login, triage, comments, settings. Route handlers under `app/api/...` are a same-origin BFF that forwards the auth cookie to the API as a Bearer header.
- `packages/shared` — **source-only** TS package. `package.json` `exports` map points `./contracts` directly at `src/contracts.ts`; there is no build step. tsx (api), Next/SWC (admin), and esbuild (widget) all compile it transitively.
- `packages/widget` — embeddable browser widget bundled with esbuild to `dist/qelp-widget.js` (IIFE, ~200 KB minified including html2canvas).

### Cross-cutting conventions

- **Single source of truth for domain types and seed data** is `packages/shared/src/contracts.ts`. The API's seeder (`apps/api/src/scripts/seed.ts`), the admin's mock-data fallback (`apps/admin/lib/api.ts`), and the widget all import from `@qelp/shared/contracts`. Changes to types or seed data ripple everywhere.
- **Node ESM in `apps/api`**: relative imports must include the `.js` extension (e.g. `import { repository } from "../repositories/postgresRepository.js"`) even though source is `.ts`.
- **Path alias** `@qelp/shared/*` is wired in `tsconfig.base.json`; runtime resolution for the same name is via the shared package's `exports` map.
- **IDs** come from `createId(prefix)` in `@qelp/shared/contracts` which uses `globalThis.crypto.getRandomValues` (cross-runtime).

### API tenancy and auth

- Login (`POST /auth/login`) issues an HMAC-signed token (`services/authTokens.ts`, signed with `AUTH_SECRET`, 12-hour TTL, payload includes `iat` and `exp`). The admin BFF (`apps/admin/app/api/auth/login/route.ts`) sets it as an `HttpOnly`, `SameSite=Lax`, `Secure`-in-prod cookie. The browser never reads the token; only the BFF does, then forwards it as `Authorization: Bearer` to the API.
- `requireAuth` middleware reads only the `Authorization` header. It attaches `request.authUser`. Every workspace-scoped route compares `request.params.workspaceId` against `authUser.workspaceId` and returns 403 on mismatch — preserve this pattern.
- `requireRole([...])` gates mutating endpoints (e.g. project create requires `owner | manager`, user CRUD requires `owner`).
- **Public unauthenticated writes** are `POST /feedback` and `POST /uploads`. Both are gated by the `x-qelp-project-key` header (must equal `client_projects.widget_token`) and rate-limited via `feedbackPublicLimiter` (`apps/api/src/middleware/rateLimit.ts`).
- `AUTH_SECRET` is rejected if it equals `"change-me-in-local-dev"` or is shorter than 32 chars when `NODE_ENV=production`.

### CORS

`apps/api/src/app.ts` mounts CORS per-router:
- `adminCors` (`origin: env.ADMIN_ORIGIN`, `credentials: true`) on `/auth`, `/workspaces`, root.
- `widgetCors` (`origin: '*'`) on `/feedback` and `/uploads` — these are gated by widget token, not origin.

There is **no global `cors()`** — adding a new router means picking the right CORS layer.

### Postgres + Drizzle

- Schema in `apps/api/src/db/schema.ts`. Tables: `agency_workspaces`, `client_projects`, `users`, `feedback_items`, `attachments`, `comments`. Enums for roles, source, status, triage_status, attachment type.
- Migrations are generated by `drizzle-kit` into `apps/api/migrations/`. The `apps/api/src/scripts/migrate.ts` script applies them via `drizzle-orm/postgres-js/migrator`.
- The repository (`apps/api/src/repositories/postgresRepository.ts`) implements `FeedbackRepository` (`apps/api/src/repositories/types.ts`). It uses Drizzle's relational queries (`with: { attachments: true, comments: true }`) for feedback reads.
- **Cursor pagination** on `listFeedback` uses `base64(createdAt|id)` over `(createdAt DESC, id DESC)`. `q` filter is ILIKE on `content_json->>'message'` and `ai_analysis_json->>'title'` for portfolio scope; a tsvector GIN index is the natural future upgrade.

### Async AI/STT triage

- `POST /feedback` persists the row with `triageStatus: 'pending'` and returns 201 immediately. `dispatchTriage(id)` (`apps/api/src/services/triagePipeline.ts`) fires `setImmediate` to run:
  1. STT on any audio attachment (Whisper via OpenAI/Groq, controlled by `STT_PROVIDER`). Result populates `voice_transcript`.
  2. AI triage via `aiTriager.analyze` — provider strategy in `apps/api/src/services/aiTriager.ts`. `FailoverAIProvider` picks OpenAI → Groq → deterministic fallback based on `AI_PROVIDER` env and which keys are set. On error, falls back to deterministic and never throws. `fetch` calls have `AbortSignal.timeout(env.AI_TIMEOUT_MS)` and message-field truncation (8000 chars).
- `triage_status` flips to `completed` or `failed`. The dispatcher is **in-process and ephemeral** — a server restart loses pending triage. Production would use a durable queue.

### Storage

- `StorageProvider` interface (`apps/api/src/services/storage/types.ts`) with put/get/delete/presignDownload.
- `LocalFsStorageProvider` (`apps/api/src/services/storage/localFs.ts`) writes under `apps/api/storage/` (gitignored) using atomic temp+rename. Key layout: `{workspaceId}/{projectId}/{attachmentId}.{ext}`.
- `apps/api/src/routes/uploads.ts` accepts multipart via `multer`, validates MIME (image/png|jpeg|webp|gif, audio/webm|ogg|mpeg|mp3|wav) and size (10 MB image, 30 MB audio), inserts an `attachments` row, links to the feedback item via `feedback_id` updated when the feedback is created.

### Admin data layer

- `apps/admin/lib/api.ts` exposes `getAgencyDashboardData(filters)`, `getFeedbackDetailData(...)`, `getWorkspaceSettingsData()`, `getWorkspaceAnalytics(...)`. They read the cookie via `next/headers`, call the API with the bearer, and on **any failure fall back to `mockFeedbackItems` etc. from `@qelp/shared/contracts`** with `usingFallback: true`. UI components disable mutating controls when `usingFallback` is true.
- BFF route handlers under `apps/admin/app/api/**`:
  - `/api/auth/{login,logout}` — sets/clears the cookie.
  - `/api/feedback/[feedbackId]` (GET, PATCH) and `/api/feedback/[feedbackId]/comments` (GET, POST).
  - `/api/uploads/[attachmentId]` (GET) — proxies attachment downloads with the bearer.
  - `/api/workspaces/[workspaceId]/projects` and nested routes (CRUD + rotate-token).
  - `/api/workspaces/[workspaceId]/users` and nested routes (CRUD).
- Pages: `/`, `/login`, `/dashboard` (filters in query string + analytics + cursor pagination), `/projects/[projectId]/feedback/[feedbackId]` (triage controls + comments thread), `/settings/projects`, `/settings/users`.

### Widget

- `packages/widget/src/index.ts` builds the DOM with `document.createElement` (no innerHTML on dynamic data; the theme color is regex-validated). The launcher and sheet both carry `data-html2canvas-ignore` so screenshots don't include the widget itself.
- Capture flow: screenshot via `html2canvas(document.body)` → `canvas.toBlob` → POST `/uploads` with `x-qelp-project-key`. Voice via `MediaRecorder` (`audio/webm`) → POST `/uploads`. The feedback POST then references the returned attachment IDs via `attachments: [{ id }]`.

## Testing

- API Vitest covers passwords, authTokens, LocalFsStorageProvider, aiTriager deterministic fallback. Add new tests under `src/**/*.test.ts`.
- Repository integration tests (against ephemeral Postgres) and route-level supertest are deferred. The CI workflow already provisions a Postgres service container so they slot in cleanly.

## Deferred / known gaps

These are deliberate cuts for portfolio scope. If you're extending the project, these are the natural next steps:

- Durable async triage queue (BullMQ or similar) instead of `setImmediate`.
- S3-backed `StorageProvider` and signed-URL serving instead of streaming through the API.
- tsvector GIN index migration for feedback search.
- Email-based user invite + password reset flow (today an owner sets the initial password manually).
- Repository + route integration tests with `testcontainers`.
- Admin component tests (Vitest + Testing Library) — admin currently has no test config.
- ESLint flat config doesn't pull in `eslint-config-next` or React-specific rules; only typescript-eslint runs.
