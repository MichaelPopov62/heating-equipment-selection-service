/**
 * Назначение: хелпери номенклатури унібоксів у каталозі.
 * Опис: id для round-trip Mongo → validateCatalog (як pumpId у насосів).
 */

/**
 * Ідентифікатор рядка каталогу при round-trip Mongo → validateCatalog.
 * У products кореневе поле id Mongoose не зберігає надійно; дубль — uniboxId при seed.
 *
 * @param {Record<string, unknown>} rec — поля документа unibox після mongoDocToPlain
 * @returns {string}
 */
export function resolveUniboxCatalogId(rec) {
  const uniboxId = rec.uniboxId != null ? String(rec.uniboxId).trim() : '';
  if (uniboxId) return uniboxId;
  const id = rec.id != null ? String(rec.id).trim() : '';
  return id;
}
