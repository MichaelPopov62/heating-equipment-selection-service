/**
 * Назначение: Output Directory `build` для Vercel при Root Directory = frontend.
 * Описание: после vite build копирует dist/ → build/ (Dashboard часто ожидает build).
 */

import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(frontendRoot, 'dist');
const dest = path.join(frontendRoot, 'build');

if (!existsSync(src)) {
  console.error('prepareVercelBuildOutput: dist/ не найден');
  process.exit(1);
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true });
}

cpSync(src, dest, { recursive: true });
console.log(`prepareVercelBuildOutput: ${src} → ${dest}`);
