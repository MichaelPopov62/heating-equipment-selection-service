/**
 * Назначение: Форматирование габаритов номенклатуры каталога.
 * @param {unknown} dimensions — объект { width, height, depth } из API
 * @returns {string} «Ш×В×Г, мм» или «—»
 */
export function formatCatalogDimensionsMm(dimensions: unknown): string {
  if (!dimensions || typeof dimensions !== 'object') return '—';
  const d = dimensions as Record<string, unknown>;
  const w = Number(d.width);
  const h = Number(d.height);
  const depth = Number(d.depth);
  if (![w, h, depth].every((n) => Number.isFinite(n))) return '—';
  return `${w}×${h}×${depth} мм`;
}
