# Qelp implementation notes

This doc summarises the scope of the `feat/implement-platform-tiers` branch
([PR #1](https://github.com/pavithrakumar2625/qlep_ai_bot/pull/1)). It is a
record of what was built, where it lives, and what is intentionally deferred.

## Diff size

- ~7,500 insertions / ~3,200 deletions across ~80 files
- 4 commits: 1 implementation commit + 3 follow-up review fixes

## What changed, by area

### Database — MySQL → Postgres + Drizzle

- Replaced hand-rolled `schema.sql` + `mysql.ts` + `initDb.ts` with:
  - `apps/api/src/db/schema.ts` (Drizzle schema)
  - `apps/api/src/db/postgres.ts` (`postgres.js` driver + Drizzle instance)
  - `apps/api/drizzle.config.ts`
  - `apps/api/migrations/0000_init.sql` (generated)
  - `apps/api/src/scripts/migrate.ts` and `seed.ts`
- New tables: `attachments`, `comments`
- New enum on `feedback_items.triage_status` (`pending | completed | failed`)
- `docker-compose.yml` brings up Postgres (and optionally api+admin via the
  `full` profile)

### Auth & sessions

- Login (`POST /auth/login`) issues an HMAC token
  (`apps/api/src/services/authTokens.ts`)
- Admin's Next.js BFF route handler at `/api/auth/login` sets the token as an
  `HttpOnly`, `SameSite=Lax`, `Secure`-in-prod cookie — the browser never
  holds the token in JS-readable form
- New BFF proxies under `apps/admin/app/api/**`:
  - `/api/auth/{login,logout}`
  - `/api/feedback/[id]` (GET, PATCH)
  - `/api/feedback/[id]/comments` (GET, POST)
  - `/api/uploads/[id]` (GET — proxies download with bearer)
  - `/api/workspaces/[wid]/projects` (POST)
  - `/api/workspaces/[wid]/projects/[pid]` (PATCH, DELETE)
  - `/api/workspaces/[wid]/projects/[pid]/rotate-token` (POST)
  - `/api/workspaces/[wid]/users` (POST)
  - `/api/workspaces/[wid]/users/[uid]` (PATCH, DELETE)
- `extractBearerToken` no longer accepts the cookie fallback
- `AUTH_SECRET` rejected in production if it equals the default or is < 32
  chars (boot-time `env.ts` superRefine)
- Email is normalised on login lookup
- Cross-workspace `assignedTo` rejected in `PATCH /feedback/:id`

### CORS, rate limits, AI hardening

- Per-router CORS:
  - `adminCors` (origin = `ADMIN_ORIGIN`, credentials) on `/auth`,
    `/workspaces`, root
  - `widgetCors` (origin = `*`) on `/feedback`, `/uploads`
  - No global `cors()`
- `express-rate-limit` (`apps/api/src/middleware/rateLimit.ts`):
  - `feedbackPublicLimiter` keyed on `(IP, x-qelp-project-key)`
  - `loginLimiter` keyed on `(IP, body.email)`
- `aiTriager` wraps `fetch` in `AbortSignal.timeout(env.AI_TIMEOUT_MS)`,
  truncates fields to 8000 chars, and logs structured failures
- `POST /feedback` returns 201 immediately and dispatches AI analysis via
  `setImmediate → triagePipeline`; `triage_status` enum tracks the lifecycle
- `services/triagePipeline.ts` orchestrates STT (if audio attachment is
  present) then AI analysis; on AI completion, merges the AI category into
  existing labels (does not clobber curator-set labels)

### Storage + uploads

- `StorageProvider` interface (`services/storage/types.ts`) +
  `LocalFsStorageProvider` writing under
  `apps/api/storage/{workspaceId}/{projectId}/{attachmentId}.{ext}`
  with atomic temp + rename and traversal protection
- `POST /uploads` (multer, multipart/form-data):
  - Auth: widget via `x-qelp-project-key` matching `client_projects.widget_token`,
    OR admin via a verified Bearer token whose `payload.workspaceId`
    matches the requested workspace
  - Rate-limited via `feedbackPublicLimiter`
  - MIME allowlist + size validation (10 MB image / 30 MB audio)
- `GET /uploads/:id`: admin-only, streams from storage with workspace check

### STT (speech-to-text)

- `services/stt.ts` calls OpenAI/Groq Whisper (`STT_PROVIDER`,
  `STT_MODEL`) with `AbortSignal.timeout`
- Falls back to no-op when no key is set
- Wired into `triagePipeline` so audio attachments get transcribed before
  the AI triage prompt is built

### Widget rewrite (`packages/widget/src/index.ts`)

- Built with `document.createElement` instead of `innerHTML` (XSS-safe)
- Real screenshot via `html2canvas`; launcher and sheet carry
  `data-html2canvas-ignore`
- Real voice recording via `MediaRecorder` (audio/webm)
- Theme color regex-validated (`#hex` only)
- Bundled to a single IIFE via `esbuild` (`dist/qelp-widget.js`, ~208 KB)
- New `packages/widget/demo/index.html` shows the embed pattern

### Admin features

- `/dashboard`:
  - Filter rail (status, project, priority, search) with URL state
  - Cursor pagination ("Load more")
  - 4 KPI tiles (open, urgent, average confidence, negative sentiment) —
    sourced from server-side analytics aggregates so they reflect the
    whole workspace
  - 4 inline-SVG charts (volume by day, priority, category, status) —
    `dashboard/charts.tsx`
- `/settings/projects` — list / create / edit / delete projects, rotate
  widget token (`projects-manager.tsx`)
- `/settings/users` — list / create / edit / delete users with role gating
  and last-owner protection (`users-manager.tsx`)
- `/projects/[projectId]/feedback/[feedbackId]` — comments thread
  (`comments-thread.tsx`) added alongside triage controls
- Login form no longer touches `document.cookie` — sign-in goes through
  `/api/auth/login`
- Triage controls go through `/api/feedback/[id]` — no JS-readable token

### API routes

| Path | Methods | Notes |
| --- | --- | --- |
| `/health` | GET | DB-backed (`SELECT 1` with 1.5s timeout) |
| `/auth/login` | POST | Rate-limited, normalised email |
| `/auth/logout` | (BFF only) | Cookie cleared client-side |
| `/auth/me` | GET | Returns the current user |
| `/workspaces` | GET | Workspace allowlist for the auth user |
| `/workspaces/:wid/projects` | GET, POST | POST gated by `owner` / `manager` |
| `/workspaces/:wid/projects/:pid` | PATCH, DELETE | DELETE gated by `owner` |
| `/workspaces/:wid/projects/:pid/rotate-token` | POST | `owner` / `manager` |
| `/workspaces/:wid/users` | GET, POST | POST gated by `owner` |
| `/workspaces/:wid/users/:uid` | PATCH, DELETE | `owner`, last-owner-protected |
| `/workspaces/:wid/feedback` | GET | Workspace-scoped feedback list |
| `/workspaces/:wid/analytics` | GET | Aggregations + workspace-wide summary |
| `/feedback` | GET | Cursor pagination + filters + ILIKE search |
| `/feedback/:id` | GET, PATCH | Workspace-scoped, role-gated PATCH |
| `/feedback` | POST | Public (widget); rate-limited; dispatches async triage |
| `/feedback/:id/comments` | GET, POST | Workspace-scoped |
| `/feedback/:id/comments/:cid` | DELETE | Author or owner |
| `/uploads` | POST | Public (widget) or admin Bearer; rate-limited |
| `/uploads/:id` | GET | Admin-only, streams |

### Repository layer

- `repositories/postgresRepository.ts` replaces `mysqlRepository.ts`
- Uses Drizzle's relational queries
  (`with: { attachments: true, comments: true }`)
- Cursor pagination on `listFeedback` over `(createdAt DESC, id DESC)`
- New methods: `createProject`, `updateProject`, `deleteProject`,
  `rotateProjectToken`, `createUser`, `updateUser`, `deleteUser`,
  `countOwners`

### Observability

- `pino` + `pino-http` with redaction for `Authorization`, `Cookie`,
  `password`, `x-qelp-project-key`
- Final express error-handling middleware returns sanitised JSON

### Engineering

- ESLint flat config (`eslint.config.mjs`) — typescript-eslint
- Prettier (`.prettierrc.json`, `.prettierignore`)
- 12 Vitest unit tests:
  - passwords (4): hash + verify roundtrip, malformed, salt uniqueness
  - authTokens (3): roundtrip, tampered, malformed
  - local-FS storage (4): roundtrip, traversal protection, idempotent
    delete, presign
  - aiTriager (1): deterministic fallback shape
- GitHub Actions CI (`.github/workflows/ci.yml`) with a Postgres service
  container running typecheck + lint + migrate + tests + widget build
- Multi-stage Dockerfiles for api + admin (Next.js standalone output)
- Cross-runtime `createId` uses `globalThis.crypto.getRandomValues`
- Root `package.json` adds `lint`, `format`, `format:check`, `typecheck`
  scripts
- README and CLAUDE.md rewritten to document the new architecture

### Review fixes (3 follow-up commits)

1. `POST /uploads` Bearer auth bypass closed — now actually verifies the
   token and matches workspaces
2. `POST /uploads` rate-limited via `feedbackPublicLimiter`
3. Async triage merges the AI category into existing labels instead of
   overwriting them; priority only updated while `triage_status` is still
   `pending`
4. Dashboard KPIs computed server-side over the whole workspace (extended
   the analytics endpoint with a `summary` block); the redundant
   `/workspaces/:id/feedback` fetch was dropped

## Surface delta

| | Before | After |
| --- | --- | --- |
| Files | 36 | 79 |
| API routes | 4 | 7 (+ comments sub-router, + nested project/user CRUD) |
| Admin pages | 4 | 7 |
| Admin BFF routes | 0 | 9 |
| DB tables | 4 (MySQL) | 6 (Postgres + Drizzle) |
| Tests | 1 | 12 |
| Bundled artifacts | none | `packages/widget/dist/qelp-widget.js` |
| CI | none | typecheck + lint + tests against ephemeral Postgres |

## How to run locally

Requires Node 20+ and Docker (for Postgres).

```bash
git checkout feat/implement-platform-tiers
npm install
cp .env.example .env

npm run db:up --workspace @qelp/api
npm run db:migrate --workspace @qelp/api
npm run db:seed --workspace @qelp/api

# two terminals
npm run dev:api      # http://localhost:4000
npm run dev:admin    # http://localhost:3000

# (optional) bundle the widget for the demo
npm run build --workspace @qelp/widget
```

Default seed login: `ana@northstar.test` / `Password123!`.

## How to verify the four review fixes

### Fix 1 — `POST /uploads` no longer accepts unverified Bearer tokens

```bash
curl -i -X POST http://localhost:4000/uploads \
  -H "Authorization: Bearer x" \
  -F "workspaceId=ws_studio" \
  -F "projectId=proj_meteor" \
  -F "file=@/some/image.png"
# expect: 401 Unauthorized
```

### Fix 2 — `POST /uploads` is rate-limited

```bash
for i in {1..31}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/uploads \
    -H "x-qelp-project-key: widget_live_meteor" \
    -F "workspaceId=ws_studio" \
    -F "projectId=proj_meteor" \
    -F "file=@/some/small.png"
done
# expect: 201 for the first 30, 429 on the 31st
```

### Fix 3 — Async triage doesn't clobber curator labels

1. Submit a feedback through the widget demo.
2. Immediately PATCH labels via the admin UI to `urgent, custom-tag` before
   the AI run completes.
3. Refresh after a couple of seconds.
4. Expected: labels include both your custom labels *and* the AI category
   (e.g. `urgent, custom-tag, authentication`).

### Fix 4 — Dashboard KPIs reflect the whole workspace

```bash
psql postgres://qelp:qelp@localhost:5432/qelp -c "
  INSERT INTO feedback_items SELECT
    'fb_load_' || gs, 'ws_studio', 'proj_meteor',
    'widget'::feedback_source, 'new'::feedback_status, 'pending'::triage_status,
    null, '{}'::jsonb, '{\"message\":\"x\",\"stepsToReproduce\":[]}'::jsonb,
    '{\"url\":\"https://x.test\",\"viewport\":{\"width\":1,\"height\":1}}'::jsonb,
    '[]'::jsonb,
    jsonb_build_object('value', 88, 'label', 'urgent'),
    null, null, now(), now()
  FROM generate_series(1, 30) gs;"
```

Reload `/dashboard`. Expected: "Urgent items" reads ~30. Before the fix
the count was capped at the first paginated page (default 25).

## Automated checks

```bash
npm run typecheck         # tsc across all 3 workspaces
npm run lint              # eslint flat config
npm run test --workspaces # 12 unit tests
```

CI runs the same on every push to `feat/implement-platform-tiers` — see
the Actions tab on the PR.

## Boot guard

```bash
NODE_ENV=production AUTH_SECRET=change-me-in-local-dev npm run dev:api
# expect: API exits with a config error before listening
```

## Intentionally deferred

These are documented in both `README.md` and `CLAUDE.md`:

- Durable async triage queue (today: in-process `setImmediate`; lost on
  server restart)
- S3-backed `StorageProvider` (interface ready)
- `tsvector` GIN index for search (today: `ILIKE`)
- Email-based user invite + password reset (today: owner sets initial
  password manually)
- Repository / route integration tests with `testcontainers`
- Admin component tests (Vitest + Testing Library)
- React/Next-specific ESLint rules
