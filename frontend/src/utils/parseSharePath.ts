/**
 * Назначение: разбор публичного пути `/s/{shareToken}`.
 */

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
