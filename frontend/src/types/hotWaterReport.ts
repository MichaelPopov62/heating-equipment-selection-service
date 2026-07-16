/**
 * Назначение: Типы блока calculations.hotWater из отчёта API.
 * Описание: ParsedHotWaterReport — SSOT для карты ГВ и сайдбара.
 */

/** Расчёт ГВС из report.calculations.hotWater после парсинга. */
export type ParsedHotWaterReport = {
  peakFlowLps: number;
  hotWaterPowerKw: number;
  peakThermalPowerKw: number | null;
  dhwSupplyScenario: 'flowThrough' | 'storage' | null;
  recommendedTankLiters: number | null;
  simultaneityFactor: number | null;
  sumFlowLpsRaw: number | null;
  objectType: 'house' | 'apartment' | null;
  residents: number | null;
  tropicalShower: boolean | null;
  coldWaterDesignSeason: 'winter' | 'summer' | null;
  designColdWaterC: number | null;
  hotWaterC: number | null;
  deltaTK: number | null;
  normsSchemaVersion: number | null;
  simultaneityBaseNorm: number | null;
  storageTankLitersPerPersonBasis: number | null;
  storageHeatTimeMinutes: number | null;
  storageIndirectHeatPowerKw: number | null;
  sessionDemandLitersMixed: number | null;
  dhwEquivalentTankLitersFromSession: number | null;
  dhwTankLitersCombinedRaw: number | null;
};
