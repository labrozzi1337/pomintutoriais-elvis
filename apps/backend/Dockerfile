FROM node:24-bookworm-slim AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci

FROM dependencies AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/backend apps/backend
RUN npm run build --workspace @start-back/backend

FROM node:24-alpine AS api
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY --from=build /app/apps/backend/.next/standalone ./
COPY --from=build /app/apps/backend/.next/static ./apps/backend/.next/static

RUN mkdir -p /data/estudio && chown -R node:node /data/estudio
USER node
EXPOSE 3000
CMD ["node", "apps/backend/server.js"]

FROM dependencies AS worker
ENV NODE_ENV=production
WORKDIR /app
RUN npm prune --omit=dev --ignore-scripts
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
COPY vitest.config.ts vitest.config.ts
COPY apps/backend apps/backend
RUN mkdir -p /data/estudio && chown -R node:node /data/estudio
USER node
CMD ["npx", "tsx", "--tsconfig", "apps/backend/tsconfig.json", "apps/backend/src/worker.ts"]

