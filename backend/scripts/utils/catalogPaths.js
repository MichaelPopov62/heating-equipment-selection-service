/**
 * Назначение: разрешение пути к JSON-файлу каталога для seed и offline-режима.
 * Описание: По умолчанию backend/test_data.json; переопределение через CATALOG_FILE_PATH или SEED_CATALOG_PATH.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Шлях до JSON каталогу для seed / offline dev (не для production mongo).
 * @returns {string}
 */
export function resolveCatalogJsonFilePath() {
  const override =
    process.env.CATALOG_FILE_PATH?.trim() || process.env.SEED_CATALOG_PATH?.trim();
  if (override) {
    return path.isAbsolute(override)
      ? override
      : path.resolve(BACKEND_ROOT, override);
  }
  return path.resolve(BACKEND_ROOT, 'test_data.json');
}
