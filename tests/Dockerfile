FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci && npx playwright install --with-deps chromium && apt-get install -y --no-install-recommends ffmpeg
COPY apps apps
COPY tests tests
COPY playwright.config.ts vitest.config.ts eslint.config.mjs ./
CMD ["sh", "-c", "node tests/proxy.mjs & npx playwright test"]
