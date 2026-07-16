/**
 * Назначение: Парсинг calculations.hotWater из отчёта POST /api/v1/calc.
 * Описание: Полный блок ГВС для карты «Горячая вода» и сайдбара.
 */

import type { ParsedHotWaterReport } from '../types/hotWaterReport';
import { isRecord, readRecordField } from './jsonGuards';

/**
 * @param value
 */
function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * @param calcReport
 * @returns {ParsedHotWaterReport | null}
 */
export function parseHotWaterFromReport(
  calcReport: unknown,
): ParsedHotWaterReport | null {
  if (!isRecord(calcReport)) return null;
  const calculations = readRecordField(calcReport, 'calculations');
  if (!calculations) return null;
  const hotWater = readRecordField(calculations, 'hotWater');
  if (!hotWater) return null;

  const peakFlowLps = readFiniteNumber(hotWater.peakFlowLps);
  const hotWaterPowerKw = readFiniteNumber(hotWater.hotWaterPowerKw);
  if (peakFlowLps == null || hotWaterPowerKw == null) return null;

  const dhwRaw = hotWater.dhwSupplyScenario;
  const dhwSupplyScenario =
    dhwRaw === 'flowThrough' || dhwRaw === 'storage' ? dhwRaw : null;

  const objectTypeRaw = hotWater.objectType;
  const objectType =
    objectTypeRaw === 'apartment' || objectTypeRaw === 'house'
      ? objectTypeRaw
      : null;

  const coldSeasonRaw = hotWater.coldWaterDesignSeason;
  const coldWaterDesignSeason =
    coldSeasonRaw === 'winter' || coldSeasonRaw === 'summer'
      ? coldSeasonRaw
      : null;

  return {
    peakFlowLps,
    hotWaterPowerKw,
    peakThermalPowerKw: readFiniteNumber(hotWater.peakThermalPowerKw),
    dhwSupplyScenario,
    recommendedTankLiters: readFiniteNumber(hotWater.recommendedTankLiters),
    simultaneityFactor: readFiniteNumber(hotWater.simultaneityFactor),
    sumFlowLpsRaw: readFiniteNumber(hotWater.sumFlowLpsRaw),
    objectType,
    residents: readFiniteNumber(hotWater.residents),
    tropicalShower:
      typeof hotWater.tropicalShower === 'boolean' ? hotWater.tropicalShower : null,
    coldWaterDesignSeason,
    designColdWaterC: readFiniteNumber(hotWater.designColdWaterC),
    hotWaterC: readFiniteNumber(hotWater.hotWaterC),
    deltaTK: readFiniteNumber(hotWater.deltaTK),
    normsSchemaVersion: readFiniteNumber(hotWater.normsSchemaVersion),
    simultaneityBaseNorm: readFiniteNumber(hotWater.simultaneityBaseNorm),
    storageTankLitersPerPersonBasis: readFiniteNumber(
      hotWater.storageTankLitersPerPersonBasis,
    ),
    storageHeatTimeMinutes: readFiniteNumber(hotWater.storageHeatTimeMinutes),
    storageIndirectHeatPowerKw: readFiniteNumber(hotWater.storageIndirectHeatPowerKw),
    sessionDemandLitersMixed: readFiniteNumber(hotWater.sessionDemandLitersMixed),
    dhwEquivalentTankLitersFromSession: readFiniteNumber(
      hotWater.dhwEquivalentTankLitersFromSession,
    ),
    dhwTankLitersCombinedRaw: readFiniteNumber(hotWater.dhwTankLitersCombinedRaw),
  };
}
