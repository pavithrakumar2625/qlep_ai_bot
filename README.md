# Qelp

Qelp is an AI-first feedback and bug triage platform built for agencies and freelancers managing multiple client products.

## Workspace layout

- `apps/api`: Express API for auth-adjacent workspace/project access, feedback intake, AI enrichment, and triage updates
- `apps/admin`: Next.js admin dashboard for agency overview, project inbox, and feedback detail review
- `packages/shared`: shared contracts, seed data, and dashboard helpers
- `packages/widget`: embeddable browser widget for client sites

## Quick start

1. `npm install`
2. Copy `.env.example` to `.env`
3. Create the MySQL database named in `.env`
4. `npm run db:init --workspace @qelp/api`
5. `npm run dev:api`
6. `npm run dev:admin`

## Local URLs

- Admin: `http://localhost:3000`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/health`
