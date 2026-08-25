#!/bin/sh
# A4 — проверка серверного PDF под лимитом 512 МБ (как на Render free).
# Запуск из корня репозитория: sh docs/audit/artifacts/A4-run-docker-512.sh [N параллельных] [балласт МБ]
# 1) собирает образ node:20-bookworm-slim + apt chromium (как в backend/Dockerfile)
# 2) запускает A4-pdf-in-512mb.mjs с --memory=512m --memory-swap=512m
# BALLAST_MB имитирует базовый RSS реального backend (справочники + Express + Mongoose).
set -e
N="${1:-1}"
B="${2:-0}"
docker build -q -t heatcalc-a4-pdf -f docs/audit/artifacts/A4-pdf.Dockerfile docs/audit/artifacts >/dev/null
docker run --rm --memory=512m --memory-swap=512m -e BALLAST_MB="$B" \
  -v "$(pwd)/docs/audit/artifacts/A4-pdf-in-512mb.mjs:/app/bench.mjs:ro" \
  heatcalc-a4-pdf node /app/bench.mjs "$N" || echo "!!! КОНТЕЙНЕР УПАЛ, exit=$? (137 = OOM-kill ядром)"
