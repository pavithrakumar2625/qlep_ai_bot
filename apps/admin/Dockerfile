# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/widget/package.json packages/widget/package.json
RUN npm ci --workspaces --include-workspace-root --ignore-scripts

FROM node:20-alpine AS build
WORKDIR /repo
ENV NEXT_OUTPUT_TRACING_ROOT=/repo
COPY --from=deps /repo/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY package.json package-lock.json ./
COPY apps/admin ./apps/admin
COPY packages/shared ./packages/shared
RUN npm run build --workspace @qelp/admin

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /repo/apps/admin/.next/standalone ./
COPY --from=build /repo/apps/admin/.next/static ./apps/admin/.next/static
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
