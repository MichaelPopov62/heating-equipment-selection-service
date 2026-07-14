/**
 * Назначение: извлечение KPI из отчёта расчёта.
 * Описание: формирует краткую сводку (теплопотери, мощность ГВС, котёл) для списка расчётов
 * в коллекции calculations MongoDB. objectType нормализуется под enum Mongoose summary.
 */
import { resolveObjectType } from '../utils/boilerMountingConstraints.js';
import { isPlainObject } from '../utils/isPlainObject.js';

/**
 * @param {import('../types/shared-types.js').HotWaterReport | undefined | null} hotWater
 * @param {import('../types/shared-types.js').BuildingObjectMeta | undefined} objectMeta
 * @returns {import('../types/shared-types.js').BuildingObjectType}
 */
function resolveSummaryObjectType(hotWater, objectMeta) {
  const fromHotWater = hotWater?.objectType;
  if (fromHotWater === 'apartment' || fromHotWater === 'house') {
    return fromHotWater;
  }
  return resolveObjectType(objectMeta);
}

/**
 * @param {import('../types/shared-types.js').CalcReport} report
 * @returns {import('../types/shared-types.js').CalculationSummary}
 */
export function extractCalculationSummary(report) {
  const heatLoss = report?.calculations?.heatLoss;
  const hotWater = report?.calculations?.hotWater;
  const boiler = report?.matching?.boiler;

  const totalWatts = heatLoss?.totalWatts;
  const heatLossKw =
    typeof totalWatts === 'number' && Number.isFinite(totalWatts)
      ? Math.round((totalWatts / 1000) * 100) / 100
      : undefined;

  const boilerModel =
    boiler?.selected?.model ??
    boiler?.proposal?.model ??
    boiler?.proposalEconomy?.model ??
    null;

  /** @type {import('../types/shared-types.js').CalculationSummary} */
  const summary = {
    insideTempC: report?.temps?.insideC,
    outsideTempC: report?.temps?.outsideC,
    objectType: resolveSummaryObjectType(
      hotWater,
      report?.input?.building?.objectMeta,
    ),
    warningsCount: Array.isArray(report?.warnings) ? report.warnings.length : 0,
    generatedAt: report?.meta?.generatedAt,
  };

  if (heatLossKw !== undefined) summary.heatLossKw = heatLossKw;
  if (typeof hotWater?.hotWaterPowerKw === 'number') {
    summary.hotWaterPowerKw = hotWater.hotWaterPowerKw;
  }
  if (typeof boiler?.requiredKw === 'number') {
    summary.boilerRequiredKw = boiler.requiredKw;
  }
  if (boilerModel) summary.boilerModel = String(boilerModel);

  return summary;
}

/**
 * Санитизация summary при чтении из MongoDB (legacy-документы с битым objectType).
 *
 * @param {unknown} summary
 * @returns {import('../types/shared-types.js').CalculationSummary}
 */
export function sanitizeCalculationSummary(summary) {
  const base = isPlainObject(summary)
      ? /** @type {import('../types/shared-types.js').CalculationSummary} */ ({ ...summary })
      : /** @type {import('../types/shared-types.js').CalculationSummary} */ ({});

  if (base.objectType === 'apartment' || base.objectType === 'house') {
    return base;
  }

  return {
    ...base,
    objectType: resolveObjectType(undefined),
  };
}
