/**
 * Назначение: дедупликация fetch за сессию (React StrictMode, повторные хуки).
 * Описание: Один in-flight Promise на ключ; при ошибке кэш сбрасывается для повтора.
 */

/** @type {Map<string, Promise<unknown>>} */
const fetchOnceCache = new Map();

/**
 * Выполняет loader один раз на key; повторные вызовы получают тот же Promise.
 *
 * @template T
 * @param {string} key — уникальный ключ запроса (URL или логическое имя)
 * @param {() => Promise<T>} loader
 * @returns {Promise<T>}
 */
export function fetchOnce<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cached = fetchOnceCache.get(key);
  if (cached) {
    return /** @type {Promise<T>} */ (cached);
  }

  const pending = loader().catch((err: unknown) => {
    fetchOnceCache.delete(key);
    throw err;
  });
  fetchOnceCache.set(key, pending);
  return pending;
}

/**
 * Сбрасывает кэш по ключу (например, перед принудительным reloadCatalog).
 *
 * @param {string} key
 */
export function invalidateFetchOnce(key: string): void {
  fetchOnceCache.delete(key);
}
