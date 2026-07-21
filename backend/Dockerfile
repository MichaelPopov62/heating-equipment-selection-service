# Production API image with system Chromium for server-side PDF.
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-dejavu-core \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PDF_BROWSER_EXECUTABLE=/usr/bin/chromium \
    PDF_RENDER_TIMEOUT_MS=30000 \
    PDF_MAX_CONCURRENT=2

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3001
CMD ["node", "src/index.js"]
