/**
 * Назначение: разрешение текстов рекомендаций.
 * Описание: подстановка шаблонов по code из переданного RecommendationsBundle; pushRecommendation
 * добавляет структурированные REC_* / WARN_* в отчёт matching. Без глобального кэша — bundle из ctx.
 */

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
 * @param {import('./types.js').RecommendationsBundle} recommendations
 * @param {string} code
 * @param {Record<string, string | number | undefined>} [vars]
 * @returns {import('./types.js').ResolvedRecommendation | null}
 */
export function resolveRecommendation(recommendations, code, vars = {}) {
  if (!recommendations?.byCode) {
    throw new Error(
      'resolveRecommendation: recommendations обязательны (передайте ctx.recommendations из CalcRuntimeContext).',
    );
  }
  const rec = recommendations.byCode[code];
  if (!rec) return null;
  const text = formatRecommendationText(rec.text, vars);
  return {
    code: rec.code,
    category: rec.category,
    equipmentType: rec.equipmentType,
    title: rec.title,
    text,
    ...(rec.resolutionSteps?.length
      ? {
          resolutionSteps: rec.resolutionSteps.map((s) => ({
            title: s.title,
            detail: s.detail,
          })),
        }
      : {}),
  };
}

/**
 * Добавить рекомендацию в warnings (текст) и в структурированный список.
 * @param {string[]} warnings
 * @param {import('./types.js').ResolvedRecommendation[]} resolvedList
 * @param {import('./types.js').RecommendationsBundle} recommendations
 * @param {string} code
 * @param {Record<string, string | number | undefined>} [vars]
 * @returns {import('./types.js').ResolvedRecommendation | null}
 */
export function pushRecommendation(
  warnings,
  resolvedList,
  recommendations,
  code,
  vars = {},
) {
  const resolved = resolveRecommendation(recommendations, code, vars);
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
