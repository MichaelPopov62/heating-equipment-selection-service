/**
 * Назначение: хелперы номенклатуры труб в каталоге.
 * Описание: единая формула подписи model и round-trip id для validateCatalog и seed.
 */

/**
 * Идентификатор строки каталога при round-trip Mongo → validateCatalog.
 * В products корневое поле id Mongoose не сохраняет надёжно; дубль — pipeId при seed.
 *
 * @param {Record<string, unknown>} rec — поля документа pipe после mongoDocToPlain (или строка каталога)
 * @returns {string}
 */
export function resolvePipeCatalogId(rec) {
  const pipeId = rec.pipeId != null ? String(rec.pipeId).trim() : '';
  if (pipeId) return pipeId;
  const id = rec.id != null ? String(rec.id).trim() : '';
  return id;
}

/**
 * Подпись модели трубы для каталога/Mongo, если в JSON нет явного model.
 *
 * @param {Record<string, unknown>} item
 * @param {number} idx — индекс в массиве pipes (fallback)
 * @returns {string}
 */
export function derivePipeModelLabel(item, idx) {
  const id = item.id != null ? String(item.id).trim() : '';
  const brand = item.brand != null ? String(item.brand).trim() : '';
  const material = item.material != null ? String(item.material).trim() : '';
  const dn = Number.isFinite(Number(item.diameter)) ? Number(item.diameter) : null;
  const wn = Number.isFinite(Number(item.wallThickness)) ? Number(item.wallThickness) : null;

  return (
    [
      id,
      brand || null,
      material || null,
      dn != null ? `Ø${dn}` : '',
      wn != null ? `×${wn}` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || `pipe-${idx}`
  );
}
