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
COPY --from=deps /repo/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY package.json package-lock.json ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
RUN npm run build --workspace @qelp/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/migrations ./migrations
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/packages/shared ./node_modules/@qelp/shared
COPY --from=build /repo/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/server.js"]
