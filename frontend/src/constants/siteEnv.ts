/**
 * Назначение: env-конфиг сайта для футера, контактов і SEO (canonical, JSON-LD).
 */

/** Production fallback — узгоджено з generateSeoStatic.mjs. */
export const PRODUCTION_SITE_ORIGIN = 'https://heatcalc-mp62.vercel.app';

/**
 * Публічний origin сайту (без trailing slash).
 * @returns {string}
 */
export function getSiteOrigin(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, '');
  }
  return PRODUCTION_SITE_ORIGIN;
}

/**
 * @returns {string}
 */
export function getSupportEmail(): string {
  const fromEnv = import.meta.env.VITE_SUPPORT_EMAIL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  return 'popov1ms@i.ua';
}

/**
 * @returns {string}
 */
export function getSupportPhone(): string {
  const fromEnv = import.meta.env.VITE_SUPPORT_PHONE;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  return '+380 68 908 34 60';
}

/**
 * @returns {string | null}
 */
export function getGithubUrl(): string | null {
  const fromEnv = import.meta.env.VITE_GITHUB_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  return null;
}
