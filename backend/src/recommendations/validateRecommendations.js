/**
 * Назначение: валидация справочника recommendations.
 * Описание: проверка и нормализация массива документов с уникальными code, category и текстами
 * для использования в recommendationResolver и отчёте calc.
 */

/**
 * @param {unknown} json — массив документов
 * @returns {import('./types').RecommendationsBundle}
 */
export function validateAndNormalizeRecommendationsBundle(json, source = 'file') {
  if (!Array.isArray(json)) {
    throw new Error('recommendations: ожидается массив документов');
  }

  /** @type {Record<string, import('./types').NormalizedRecommendation>} */
  const byCode = {};

  for (let i = 0; i < json.length; i++) {
    const raw = json[i];
    if (!raw || typeof raw !== 'object') {
      throw new Error(`recommendations[${i}]: ожидается объект`);
    }
    const d = /** @type {Record<string, unknown>} */ (raw);
    const code = String(d.code ?? '').trim();
    if (!code) {
      throw new Error(`recommendations[${i}].code: обязательная непустая строка`);
    }
    if (byCode[code]) {
      throw new Error(`recommendations: дублирующийся code «${code}»`);
    }
    const schemaVersionRaw = Number(d.schemaVersion);
    if (!Number.isFinite(schemaVersionRaw) || Math.trunc(schemaVersionRaw) < 1) {
      throw new Error(`recommendations[${code}].schemaVersion: обязательное целое >= 1`);
    }
    const category = String(d.category ?? '').trim();
    if (category !== 'warnings' && category !== 'automationHints') {
      throw new Error(
        `recommendations[${code}].category: ожидается warnings или automationHints`,
      );
    }
    const equipmentType = String(d.equipmentType ?? '').trim();
    if (!equipmentType) {
      throw new Error(`recommendations[${code}].equipmentType: обязательная строка`);
    }
    const title = String(d.title ?? '').trim();
    const text = String(d.text ?? '').trim();
    if (!title) {
      throw new Error(`recommendations[${code}].title: обязательная непустая строка`);
    }
    if (!text) {
      throw new Error(`recommendations[${code}].text: обязательная непустая строка`);
    }

    byCode[code] = {
      code,
      schemaVersion: Math.trunc(schemaVersionRaw),
      category: /** @type {import('./types').RecommendationCategory} */ (category),
      equipmentType,
      title,
      text,
    };
  }

  const required = /** @type {const} */ ([
    'REC_BOILER_OPTIMAL',
    'WARN_BOILER_UNDERPOWERED',
    'WARN_DHW_TIME_LONG',
  ]);
  for (const code of required) {
    if (!byCode[code]) {
      throw new Error(`recommendations: отсутствует обязательный code=${code}`);
    }
  }

  return { byCode, source };
}
