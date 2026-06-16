/**
 * Назначение: извлечение KPI из отчёта расчёта.
 * Описание: формирует краткую сводку (теплопотери, мощность ГВС, котёл) для списка расчётов
 * в коллекции calculations MongoDB.
 */
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
    objectType: report?.input?.building?.objectMeta?.objectType,
    warningsCount: Array.isArray(report?.warnings) ? report.warnings.length : 0,
    generatedAt: report?.meta?.generatedAt,
  };
}
