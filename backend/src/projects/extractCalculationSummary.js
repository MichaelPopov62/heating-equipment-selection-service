/**
 * Назначение: извлечение KPI из отчёта расчёта.
 * Описание: формирует краткую сводку (теплопотери, мощность ГВС, котёл) для списка расчётов
 * в коллекции calculations MongoDB. objectType нормализуется под enum Mongoose summary.
 */
import { resolveObjectType } from '../utils/boilerMountingConstraints.js';
import { isPlainObject } from '../utils/isPlainObject.js';

/**
 * @param {import('../types/shared-types').HotWaterReport | undefined | null} hotWater
 * @param {import('../types/shared-types').BuildingObjectMeta | undefined} objectMeta
 * @returns {import('../types/shared-types').BuildingObjectType}
 */
function resolveSummaryObjectType(hotWater, objectMeta) {
  const fromHotWater = hotWater?.objectType;
  if (fromHotWater === 'apartment' || fromHotWater === 'house') {
    return fromHotWater;
  }
  return resolveObjectType(objectMeta);
}

/**
 * @param {import('../types/shared-types').CalcReport} report
 * @returns {import('../types/shared-types').CalculationSummary}
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

  return {
    heatLossKw,
    hotWaterPowerKw:
      typeof hotWater?.hotWaterPowerKw === 'number' ? hotWater.hotWaterPowerKw : undefined,
    boilerRequiredKw: typeof boiler?.requiredKw === 'number' ? boiler.requiredKw : undefined,
    boilerModel: boilerModel ? String(boilerModel) : undefined,
    insideTempC: report?.temps?.insideC,
    outsideTempC: report?.temps?.outsideC,
    objectType: resolveSummaryObjectType(
      hotWater,
      report?.input?.building?.objectMeta,
    ),
    warningsCount: Array.isArray(report?.warnings) ? report.warnings.length : 0,
    generatedAt: report?.meta?.generatedAt,
  };
}

/**
 * Санитизация summary при чтении из MongoDB (legacy-документы с битым objectType).
 *
 * @param {unknown} summary
 * @returns {import('../types/shared-types').CalculationSummary}
 */
export function sanitizeCalculationSummary(summary) {
  const base = isPlainObject(summary)
      ? /** @type {import('../types/shared-types').CalculationSummary} */ ({ ...summary })
      : /** @type {import('../types/shared-types').CalculationSummary} */ ({});

  if (base.objectType === 'apartment' || base.objectType === 'house') {
    return base;
  }

  return {
    ...base,
    objectType: resolveObjectType(undefined),
  };
}
