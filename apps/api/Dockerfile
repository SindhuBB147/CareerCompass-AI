FROM node:20-alpine AS builder
WORKDIR /app

# Root-context build: packages/config|types|utils live outside apps/api, so
# the build context is the repo root (see docker-compose.yml) and everything
# needed for `npm ci` to resolve the @career-compass/* workspace deps is
# copied in before installing.
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci

COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/src ./apps/api/src
RUN npm run build -w packages/config -w packages/types -w packages/utils \
 && npm run build -w apps/api \
 && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Chromium for the Student Reports module's PDF generation (Puppeteer via
# puppeteer-core — no bundled Chromium download; this system install is
# required instead). Runtime dependency, so it belongs in this final stage,
# not just the builder.
RUN apk add --no-cache chromium nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
EXPOSE 3000
USER node
CMD ["node", "apps/api/dist/main.js"]
