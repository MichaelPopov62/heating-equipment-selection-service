/**
 * Назначение: подготовка Output Directory для Vercel.
 * Описание: копирует frontend/dist → build/ (Dashboard часто ожидает каталог build).
 */

import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(repoRoot, 'frontend', 'dist');
const dest = path.join(repoRoot, 'build');

if (!existsSync(src)) {
  console.error(`vercelPrepareOutput: не найден ${src} — сначала выполните сборку frontend`);
  process.exit(1);
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true });
}

cpSync(src, dest, { recursive: true });
console.log(`vercelPrepareOutput: ${src} → ${dest}`);
