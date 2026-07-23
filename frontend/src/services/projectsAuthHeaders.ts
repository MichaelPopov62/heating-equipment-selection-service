/**
 * Назначение: заголовки Authorization для API проектов.
 * Описание: Clerk getToken() → localStorage → VITE_PROJECTS_BEARER_TOKEN (dev/CI).
 */

import { resolveProjectsBearerToken } from './projectsAuthToken';

/**
 * @returns {Promise<Record<string, string>>}
 */
export async function getProjectsAuthHeaders(): Promise<Record<string, string>> {
  const token = await resolveProjectsBearerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
