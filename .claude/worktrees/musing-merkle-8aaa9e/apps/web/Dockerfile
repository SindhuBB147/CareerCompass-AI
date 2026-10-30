FROM node:20-alpine AS builder
WORKDIR /app

# Root-context build: packages/config|types|utils live outside apps/web, so
# the build context is the repo root (see docker-compose.yml) and everything
# needed for `npm ci` to resolve the @career-compass/* workspace deps is
# copied in before installing.
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci

COPY apps/web ./apps/web
RUN npm run build -w packages/config -w packages/types -w packages/utils \
 && npm run build -w apps/web \
 && npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3001
CMD ["npm", "run", "start", "-w", "apps/web"]
