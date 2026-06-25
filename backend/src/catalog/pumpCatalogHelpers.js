/**
 * Назначение: хелперы номенклатуры насосов в каталоге.
 * Описание: id для round-trip Mongo → validateCatalog и slug из model при seed.
 */

/**
 * Идентификатор строки каталога при round-trip Mongo → validateCatalog.
 * В products корневое поле id Mongoose не сохраняет надёжно; дубль — pumpId при seed.
 *
 * @param {Record<string, unknown>} rec — поля документа pump после mongoDocToPlain (или строка каталога)
 * @returns {string}
 */
export function resolvePumpCatalogId(rec) {
  const pumpId = rec.pumpId != null ? String(rec.pumpId).trim() : '';
  if (pumpId) return pumpId;
  const id = rec.id != null ? String(rec.id).trim() : '';
  return id;
}

/**
 * Slug id насоса из model (fallback при отсутствии явного id в JSON).
 *
 * @param {string} model
 * @param {number} idx — индекс в массиве pumps (fallback)
 * @returns {string}
 */
export function derivePumpCatalogIdFromModel(model, idx) {
  const base = String(model)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return base || `pump-${idx}`;
}
