/**
 * Назначение: разрешение текстов рекомендаций.
 * Описание: подстановка шаблонов по code из кэша recommendations; pushRecommendation добавляет
 * структурированные REC_*или WARN_* сообщения в отчёт matching.
 */
/** @type {import('./types').RecommendationsBundle | null} */
let cachedRecommendations = null;

/**
 * @param {import('./types').RecommendationsBundle} bundle
 */
export function setRecommendationsCache(bundle) {
  cachedRecommendations = bundle;
}

/** @returns {import('./types').RecommendationsBundle} */
function getRecommendationsCache() {
  if (!cachedRecommendations) {
    throw new Error(
      'Справочник recommendations не загружен. Вызовите warmupReferenceCache() / getReferenceBundle().',
    );
  }
  return cachedRecommendations;
}

/**
 * Подстановка {{key}} в шаблон.
 * @param {string} template
 * @param {Record<string, string | number | undefined>} [vars]
 */
function formatRecommendationText(template, vars = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

/**
 * @param {string} code
 * @param {Record<string, string | number | undefined>} [vars]
 * @returns {import('./types').ResolvedRecommendation | null}
 */
export function resolveRecommendation(code, vars = {}) {
  const rec = getRecommendationsCache().byCode[code];
  if (!rec) return null;
  const text = formatRecommendationText(rec.text, vars);
  return {
    code: rec.code,
    category: rec.category,
    equipmentType: rec.equipmentType,
    title: rec.title,
    text,
  };
}

/**
 * Добавить рекомендацию в warnings (текст) и в структурированный список.
 * @param {string[]} warnings
 * @param {import('./types').ResolvedRecommendation[]} resolvedList
 * @param {string} code
 * @param {Record<string, string | number | undefined>} [vars]
 * @returns {import('./types').ResolvedRecommendation | null}
 */
export function pushRecommendation(warnings, resolvedList, code, vars = {}) {
  const resolved = resolveRecommendation(code, vars);
  if (!resolved) {
    warnings.push(`[${code}] Текст рекомендации не найден в справочнике.`);
    return null;
  }
  if (resolved.category === 'warnings') {
    warnings.push(resolved.text);
  }
  resolvedList.push(resolved);
  return resolved;
}
