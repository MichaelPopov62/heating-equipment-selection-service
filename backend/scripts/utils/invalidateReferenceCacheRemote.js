/**
 * Назначение: HTTP-инвалидация reference bundle после seed или правки Mongo.
 * Описание: Вызывает POST /api/v1/system/invalidate-reference-cache на работающем API.
 */

/**
 * @returns {boolean}
 */
function shouldAutoInvalidateAfterSeed() {
  if (process.env.AUTO_INVALIDATE_CACHE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

/**
 * @returns {string}
 */
function resolveApiBaseUrl() {
  const explicit = process.env.API_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const port = process.env.PORT?.trim() || '3001';
  return `http://127.0.0.1:${port}`;
}

/**
 * После успешного seed — сброс in-memory bundle на API (если включено и API доступен).
 *
 * @returns {Promise<void>}
 */
export async function tryInvalidateReferenceCacheRemote() {
  if (!shouldAutoInvalidateAfterSeed()) {
    return;
  }

  const token = process.env.SYSTEM_INTERNAL_TOKEN?.trim();
  if (!token) {
    process.stderr.write(
      '[seed] AUTO_INVALIDATE_CACHE: пропуск — SYSTEM_INTERNAL_TOKEN не задан в backend/.env\n',
    );
    return;
  }

  const url = `${resolveApiBaseUrl()}/api/v1/system/invalidate-reference-cache`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-System-Token': token,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      process.stderr.write(
        `[seed] invalidate-reference-cache HTTP ${res.status}: ${body.slice(0, 200)}\n`,
      );
      return;
    }

    /** @type {{ referenceBundleLoadedAt?: number }} */
    const payload = await res.json();
    process.stdout.write(
      `[seed] reference cache invalidated; loadedAt=${payload.referenceBundleLoadedAt ?? '?'}\n`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[seed] invalidate-reference-cache failed (${url}): ${msg}\n`,
    );
  }
}
