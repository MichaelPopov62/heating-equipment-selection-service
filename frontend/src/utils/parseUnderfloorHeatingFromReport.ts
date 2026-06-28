/**
 * Назначение: Парсинг расчёта тёплого пола из отчёта API.
 */

import type { CalcReportJson } from '../types/calcApi';
import type {
  ParsedUnderfloorHeating,
  ParsedUnderfloorHeatingRoom,
  ParsedUnderfloorHydraulics,
  ParsedUfhLoopHydraulics,
  ParsedUfhMixingNodeSpec,
} from '../types/underfloorHeating';
import type { UfhDistributionPreset } from '../types/ufhDistribution';
import { isUfhDistributionPreset } from '../types/ufhDistribution';
import { isRecord, readRecordField, readStringArray } from './jsonGuards';

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseMixingNode(block: Record<string, unknown>): ParsedUfhMixingNodeSpec | null {
  const raw = block.mixingNode;
  if (!isRecord(raw)) return null;

  const presetRaw = raw.distributionPreset;
  const distributionPreset =
    typeof presetRaw === 'string'
    && isUfhDistributionPreset(presetRaw)
    && presetRaw !== 'auto'
      ? presetRaw
      : null;

  return {
    boilerSupplyC: readFiniteNumber(raw.boilerSupplyC),
    floorCircuitSupplyC: readFiniteNumber(raw.floorCircuitSupplyC),
    deltaTK: readFiniteNumber(raw.deltaTK),
    flowRateM3PerHour: readFiniteNumber(raw.flowRateM3PerHour),
    headMetersMin: readFiniteNumber(raw.headMetersMin),
    valveKvsMin: readFiniteNumber(raw.valveKvsMin),
    distributionPreset,
    notes: readStringArray(raw.notes),
  };
}

function parseUnderfloorHydraulics(
  block: Record<string, unknown>,
): ParsedUnderfloorHydraulics | null {
  const raw = block.underfloorHydraulics;
  if (!isRecord(raw)) return null;
  const deltaTK = readFiniteNumber(raw.deltaTK);
  const massFlowKgPerSec = readFiniteNumber(raw.massFlowKgPerSec);
  const flowRateM3PerHour = readFiniteNumber(raw.flowRateM3PerHour);
  if (deltaTK == null || massFlowKgPerSec == null || flowRateM3PerHour == null) return null;
  return { deltaTK, massFlowKgPerSec, flowRateM3PerHour };
}

function parseDistributionPreset(
  value: unknown,
): Exclude<UfhDistributionPreset, 'auto'> | null {
  if (typeof value !== 'string' || !isUfhDistributionPreset(value) || value === 'auto') {
    return null;
  }
  return value;
}

function parseLoopResolutionStatus(
  value: unknown,
): ParsedUnderfloorHeatingRoom['loopHydraulicsResolutionStatus'] | null {
  if (
    value === 'resolved_auto'
    || value === 'unresolved_velocity'
    || value === 'unresolved_pressure'
    || value === 'unresolved_conflict'
  ) {
    return value;
  }
  return null;
}

function parseLoopAppliedFix(
  value: unknown,
): ParsedUnderfloorHeatingRoom['loopHydraulicsAppliedFix'] | null {
  if (
    value === 'none'
    || value === 'loops_reduced'
    || value === 'loops_increased'
    || value === 'pipe_downsized'
    || value === 'pipe_upsized'
  ) {
    return value;
  }
  return null;
}

function parseUfhLoopHydraulics(item: unknown): ParsedUfhLoopHydraulics | null {
  if (!isRecord(item)) return null;

  const hydRaw = item.hydraulics;
  const src = isRecord(hydRaw) ? hydRaw : item;

  const loopId = typeof src.loopId === 'string' ? src.loopId : '';
  if (!loopId) return null;

  const lengthM = readFiniteNumber(src.lengthM) ?? readFiniteNumber(item.estimatedLengthM);
  const flowRateM3PerHour =
    readFiniteNumber(src.flowRateM3PerHour) ?? readFiniteNumber(item.flowRateM3PerHour);
  if (lengthM == null || flowRateM3PerHour == null) return null;

  const actionRaw = src.pipeResizeAction;
  const pipeResizeAction =
    actionRaw === 'upsized'
    || actionRaw === 'downsized'
    || actionRaw === 'loops_adjusted'
    || actionRaw === 'unchanged'
      ? actionRaw
      : 'unchanged';

  const reasonRaw = src.pipeResizeReason;
  const pipeResizeReason =
    typeof reasonRaw === 'string' && reasonRaw.trim() !== '' ? reasonRaw : null;

  return {
    loopId,
    lengthM,
    flowRateM3PerHour,
    internalDiameterMm: readFiniteNumber(src.internalDiameterMm),
    velocityMps: readFiniteNumber(src.velocityMps),
    pressureDropKPa: readFiniteNumber(src.pressureDropKPa),
    catalogPipeId: typeof src.catalogPipeId === 'string' ? src.catalogPipeId : null,
    initialCatalogPipeId:
      typeof src.initialCatalogPipeId === 'string' ? src.initialCatalogPipeId : null,
    pipeResizeAction,
    pipeResizeReason,
    warnings: readStringArray(src.warnings),
  };
}

function parseRoomRow(item: unknown): ParsedUnderfloorHeatingRoom | null {
  if (!isRecord(item)) return null;
  const roomId = typeof item.roomId === 'string' ? item.roomId : '';
  const roomName =
    typeof item.roomName === 'string' && item.roomName.trim() !== ''
      ? item.roomName
      : roomId || '—';
  const finishMaterialName =
    typeof item.finishMaterialName === 'string' && item.finishMaterialName.trim() !== ''
      ? item.finishMaterialName
      : typeof item.finishMaterialId === 'string'
        ? item.finishMaterialId
        : '—';
  const basePresetName =
    typeof item.basePresetName === 'string' && item.basePresetName.trim() !== ''
      ? item.basePresetName
      : typeof item.basePresetId === 'string'
        ? item.basePresetId
        : '—';

  const requiredNums = [
    item.heatFluxUpWm2,
    item.heatFluxDownWm2,
    item.heatFluxUpWatts,
    item.heatFluxDownWatts,
    item.surfaceTempC,
    item.maxSurfaceTemperatureCelsius,
    item.coveringResistanceM2KW,
  ];
  if (!requiredNums.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;

  const maxAllowableRaw = item.maxAllowableHeatFluxUpWm2;
  const maxAllowableHeatFluxUpWm2 =
    typeof maxAllowableRaw === 'number' && Number.isFinite(maxAllowableRaw)
      ? maxAllowableRaw
      : 0;

  const pipeSpacingRaw = item.pipeSpacingMm;
  const pipeSpacingMm =
    pipeSpacingRaw === 100 || pipeSpacingRaw === 150 || pipeSpacingRaw === 200
      ? pipeSpacingRaw
      : 150;

  const pipeEmbedRaw = item.pipeEmbedmentResistanceM2KW;
  const pipeEmbedmentResistanceM2KW =
    typeof pipeEmbedRaw === 'number' && Number.isFinite(pipeEmbedRaw) ? pipeEmbedRaw : 0;

  const finishCoveringRaw = item.finishCoveringResistanceM2KW;
  const finishCoveringResistanceM2KW =
    typeof finishCoveringRaw === 'number' && Number.isFinite(finishCoveringRaw)
      ? finishCoveringRaw
      : (item.coveringResistanceM2KW as number);

  const comfortRaw = item.comfortMaxSurfaceTemperatureCelsius;
  const comfortMaxSurfaceTemperatureCelsius =
    typeof comfortRaw === 'number' && Number.isFinite(comfortRaw) ? comfortRaw : null;

  const finishMaxRaw = item.finishMaxSurfaceTemperatureCelsius;
  const finishMaxSurfaceTemperatureCelsius =
    typeof finishMaxRaw === 'number' && Number.isFinite(finishMaxRaw)
      ? finishMaxRaw
      : undefined;

  const presetMaxRaw = item.presetMaxSurfaceTemperatureCelsius;
  const presetMaxSurfaceTemperatureCelsius =
    typeof presetMaxRaw === 'number' && Number.isFinite(presetMaxRaw)
      ? presetMaxRaw
      : undefined;

  const loopsCountRaw = item.loopsCount;
  const loopsCount =
    typeof loopsCountRaw === 'number' && Number.isFinite(loopsCountRaw)
      ? loopsCountRaw
      : undefined;

  const loops: ParsedUfhLoopHydraulics[] = [];
  if (Array.isArray(item.loops)) {
    for (const loopRow of item.loops) {
      const parsedLoop = parseUfhLoopHydraulics(loopRow);
      if (parsedLoop) loops.push(parsedLoop);
    }
  }

  const loopHydraulicsResolutionStatus = parseLoopResolutionStatus(
    item.loopHydraulicsResolutionStatus,
  );
  const loopHydraulicsAppliedFix = parseLoopAppliedFix(item.loopHydraulicsAppliedFix);

  return {
    roomId,
    roomName,
    basePresetName,
    finishMaterialName,
    heatFluxUpWm2: item.heatFluxUpWm2 as number,
    heatFluxDownWm2: item.heatFluxDownWm2 as number,
    maxAllowableHeatFluxUpWm2,
    heatFluxUpWatts: item.heatFluxUpWatts as number,
    heatFluxDownWatts: item.heatFluxDownWatts as number,
    surfaceTempC: item.surfaceTempC as number,
    maxSurfaceTemperatureCelsius: item.maxSurfaceTemperatureCelsius as number,
    comfortMaxSurfaceTemperatureCelsius,
    finishMaxSurfaceTemperatureCelsius,
    presetMaxSurfaceTemperatureCelsius,
    pipeSpacingMm,
    pipeEmbedmentResistanceM2KW,
    finishCoveringResistanceM2KW,
    coveringResistanceM2KW: item.coveringResistanceM2KW as number,
    ...(loopsCount != null ? { loopsCount } : {}),
    ...(item.pipeResizeApplied === true ? { pipeResizeApplied: true } : {}),
    ...(loopHydraulicsResolutionStatus
      ? { loopHydraulicsResolutionStatus }
      : {}),
    ...(loopHydraulicsAppliedFix ? { loopHydraulicsAppliedFix } : {}),
    ...(loops.length > 0 ? { loops } : {}),
    warnings: readStringArray(item.warnings),
  };
}

export function parseUnderfloorHeatingFromReport(
  calcReport: CalcReportJson | null,
): ParsedUnderfloorHeating | null {
  if (calcReport === null) return null;
  const calculations = readRecordField(calcReport, 'calculations');
  if (!calculations) return null;
  const block = readRecordField(calculations, 'underfloorHeating');
  if (!block) return null;

  const supply = block.circuitSupplyC;
  const ret = block.circuitReturnC;
  const mean = block.circuitMeanC;
  if (typeof supply !== 'number' || typeof ret !== 'number' || typeof mean !== 'number') {
    return null;
  }

  const source = block.circuitSource;
  const circuitSource =
    source === 'heatingSystem'
    || source === 'mixed_default'
    || source === 'finish_preset'
    || source === 'ufh_mode_preset'
      ? source
      : 'mixed_default';

  const rooms: ParsedUnderfloorHeatingRoom[] = [];
  if (Array.isArray(block.rooms)) {
    for (const row of block.rooms) {
      const parsed = parseRoomRow(row);
      if (parsed) rooms.push(parsed);
    }
  }

  const totalUp = block.totalHeatFluxUpWatts;
  const totalDown = block.totalHeatFluxDownWatts;
  if (typeof totalUp !== 'number' || typeof totalDown !== 'number') return null;

  return {
    circuitSupplyC: supply,
    circuitReturnC: ret,
    circuitMeanC: mean,
    circuitSource,
    isMixingNodeRequired: block.isMixingNodeRequired === true,
    distributionPreset: parseDistributionPreset(block.distributionPreset),
    mixingNode: parseMixingNode(block),
    underfloorHydraulics: parseUnderfloorHydraulics(block),
    rooms,
    totalHeatFluxUpWatts: totalUp,
    totalHeatFluxDownWatts: totalDown,
    warnings: readStringArray(block.warnings),
  };
}
