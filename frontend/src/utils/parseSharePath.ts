/**
 * Назначение: разбор публичного пути `/s/{shareToken}`.
 */

const SHARE_PATH_RE = /^\/s\/([A-Za-z0-9_-]{16,128})\/?$/;

/**
 * @param pathname — window.location.pathname
 * @returns токен или null
 */
export function parseShareTokenFromPath(pathname: string): string | null {
  const m = SHARE_PATH_RE.exec(pathname);
  return m?.[1] ?? null;
}

/**
 * Полный публичный URL по пути `/s/{token}`.
 *
 * @param publicPath — `/s/{token}` с сервера
 */
function buildPublicShareUrl(publicPath: string): string {
  const path = publicPath.startsWith('/') ? publicPath : `/${publicPath}`;
  return `${window.location.origin}${path}`;
}

/**
 * Полный публичный URL по shareToken (для буфера обмена).
 *
 * @param shareToken — токен с сервера после publish
 */
export function buildPublicShareUrlFromToken(shareToken: string): string {
  return buildPublicShareUrl(`/s/${shareToken}`);
}
