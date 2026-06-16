/**
 * Назначение: Конфигурация сборки Vite.
 * Описание: React-плагин, __APP_VERSION__, прокси /api и /health на backend :3001.
 */

import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(
      JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version,
    ),
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
