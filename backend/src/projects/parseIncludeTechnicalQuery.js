/**
 * Назначение: парсинг query includeTechnical для PDF endpoints.
 */

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function parseIncludeTechnicalQuery(raw) {
  if (raw === true || raw === 1) return true;
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }
  if (Array.isArray(raw)) return parseIncludeTechnicalQuery(raw[0]);
  return false;
}
