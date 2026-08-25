# A4 — окружение для замера PDF под лимитом памяти. Зеркалит backend/Dockerfile.
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation fonts-dejavu-core ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV PDF_BROWSER_EXECUTABLE=/usr/bin/chromium PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /app
RUN npm install --no-save puppeteer-core@24.22.0
