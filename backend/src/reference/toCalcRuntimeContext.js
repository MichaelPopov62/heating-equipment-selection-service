/**
 * Назначение: фабрика CalcRuntimeContext из ReferenceBundle.
 * Описание: Composition root — единственное место сборки контекста расчёта для validate/buildReport.
 */

/**
 * @param {import('./configCache.js').ReferenceBundle} bundle
 * @returns {import('../types/shared-types.js').CalcRuntimeContext}
 */
export function toCalcRuntimeContext(bundle) {
  return Object.freeze({
    catalog: bundle.catalog,
    waterNorms: bundle.waterNorms,
    appliances: bundle.appliances,
    recommendations: bundle.recommendations,
    ufhPresets: bundle.ufhPresets,
    sources: Object.freeze({
      catalog: bundle.catalogSource,
      waterNorms: bundle.waterNormsSource,
      appliances: bundle.appliancesSource,
      recommendations: bundle.recommendationsSource,
      ufhPresets: bundle.ufhPresetsSource,
      loadedAt: bundle.loadedAt,
    }),
  });
}
