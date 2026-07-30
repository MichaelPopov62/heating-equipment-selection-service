/**
 * Назначение: единая сборка URL для HTTP-клиентов frontend.
 * Описание: VITE_API_BASE_URL задаёт Render API в staging/production;
 * без него — относительные /api/... и Vite proxy на localhost:3001.
 */

/**
 * Нормализованный базовый URL backend без завершающего слэша.
 *
 * @returns пустая строка — режим dev/proxy (относительные пути)
 */
function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
}

/**
 * Собирает URL для fetch: абсолютный при заданном VITE_API_BASE_URL или относительный в dev.
 *
 * @param path — путь от корня хоста API, например `/api/v1/calc`
 * @returns готовый URL для fetch
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  if (!base) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
