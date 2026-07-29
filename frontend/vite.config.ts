/**
 * Назначение: Конфигурация сборки Vite.
 * Описание: React-плагин, __APP_VERSION__/__APP_BUILD_*__, прокси /api и /health на backend :3001.
 */

import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function formatBuildDate(d: Date): string {
  const y = String(d.getUTCFullYear());
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version: string };

const buildDate = formatBuildDate(new Date());
const buildId =
  process.env.VITE_BUILD_ID?.trim() ||
  process.env.GITHUB_SHA?.slice(0, 7) ||
  'local';

/**
 * Розбиття vendor-залежностей на окремі чанки для кешування браузера та зменшення головного бандла.
 *
 * @param id — абсолютний шлях модуля під час збірки Rollup
 */
function resolveManualChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('@clerk')) return 'clerk';
  if (id.includes('@tanstack/react-query')) return 'query';
  if (id.includes('react-router')) return 'router';
  if (id.includes('react-dom')) return 'react-dom';
  if (id.includes('/react/')) return 'react';
  return undefined;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD_DATE__: JSON.stringify(buildDate),
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    proxy: {
      // Проксируем API на backend в dev, чтобы fetch('/api/...') работал из Vite (5173).
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Расчёт с Mongo/Meteostat может занимать десятки секунд — иначе прокси обрывает запрос (Failed to fetch).
        timeout: 120_000,
        proxyTimeout: 120_000,
      },
      '/health': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        timeout: 120_000,
        proxyTimeout: 120_000,
      },
      '/health': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
