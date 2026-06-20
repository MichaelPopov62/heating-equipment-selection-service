/**
 * Назначение: заголовки Authorization для API проектов.
 * Описание: Bearer JWT из localStorage или VITE_PROJECTS_BEARER_TOKEN (только dev/тест).
 */

const STORAGE_KEY = 'projectsApiBearerToken';

/**
 * @returns {Record<string, string>}
 */
export function getProjectsAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const fromStorage =
    typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY)?.trim() : '';
  const fromEnv =
    typeof import.meta.env.VITE_PROJECTS_BEARER_TOKEN === 'string'
      ? import.meta.env.VITE_PROJECTS_BEARER_TOKEN.trim()
      : '';
  const token = fromStorage || fromEnv;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * @param {string | null} token — null удаляет сохранённый токен
 */
export function setProjectsBearerToken(token: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (token?.trim()) {
    localStorage.setItem(STORAGE_KEY, token.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}
