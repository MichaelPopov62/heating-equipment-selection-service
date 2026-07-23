/**
 * Назначение: разрешение Bearer JWT для API проектов (Clerk getToken → fallback dev).
 */

import { readStoredAuthToken } from '../auth/authConfig';

/** Async-источник JWT (Clerk SDK регистрирует getter из AuthProvider). */
export type ProjectsAuthTokenGetter = () => Promise<string | null>;

let activeGetter: ProjectsAuthTokenGetter | null = null;

/**
 * @param getter
 */
export function setProjectsAuthTokenGetter(getter: ProjectsAuthTokenGetter | null): void {
  activeGetter = getter;
}

/**
 * Приоритет: Clerk getToken() → localStorage → VITE_PROJECTS_BEARER_TOKEN.
 *
 * @returns {Promise<string | null>}
 */
export async function resolveProjectsBearerToken(): Promise<string | null> {
  if (activeGetter) {
    try {
      const fromClerk = await activeGetter();
      if (fromClerk?.trim()) return fromClerk.trim();
    } catch {
      // fallback ниже
    }
  }

  const fromStorage = readStoredAuthToken();
  if (fromStorage) return fromStorage;

  const fromEnv =
    typeof import.meta.env.VITE_PROJECTS_BEARER_TOKEN === 'string'
      ? import.meta.env.VITE_PROJECTS_BEARER_TOKEN.trim()
      : '';
  return fromEnv || null;
}
