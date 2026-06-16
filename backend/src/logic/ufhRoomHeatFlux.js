/**
 * Назначение: теплоотдача водяного ТП по одной комнате (q↑/q↓, Tповерх).
 * Описание: Физика покрытия base+finish; без оркестрации отчёта.
 */

import {
  computeBaseCoveringResistanceM2KW,
  computeComposedCoveringResistanceM2KW,
  computeLayerResistanceM2KW,
} from '../data/warmFloorAssemblyPresets.js';
import { computeFinishCoveringResistanceM2KW } from '../data/flooringFinishMaterials.js';
import { resolvePipeEmbedmentResistanceM2KW } from './ufhPipeEmbedment.js';
import { round } from '../utils/math.js';

/** Сопротивление конвекции пол→воздух, м²·K/Вт. */
export const R_CONV_UP_M2KW = 0.1;
/** От плиты к тёплому перекрытию соседа. */
export const R_CONV_DOWN_HEATED_M2KW = 0.05;
/** От плиты к холодной зоне снизу. */
export const R_CONV_DOWN_UNHEATED_M2KW = 0.15;

/**
 * @param {import('../types/shared-types').UnderfloorHeatingAssemblyLayer[]} layers
 * @param {number} heatingIdx
 * @returns {number}
 */
function sumResistanceBelowHeatingLayer(layers, heatingIdx) {
  let sum = 0;
  for (let i = 0; i < heatingIdx; i += 1) {
    sum += computeLayerResistanceM2KW(layers[i]);
  }
  return sum;
}

/**
 * Лимит температуры поверхности: min(пресет Mongo, паспорт финиша) при заданном пресете.
 *
 * @param {number | undefined} presetMaxSurfaceTemperatureC — technical.maxSurfaceTemperatureC
 * @param {import('../types/shared-types').FlooringFinishMaterial} finish
 * @returns {{
 *   appliedMaxSurfaceT: number,
 *   appliedComfortMaxSurfaceT: number,
 *   finishMaxSurfaceT: number,
 *   presetMaxSurfaceT?: number,
 * }}
 */
function resolveAppliedSurfaceTemperatureLimits(
  presetMaxSurfaceTemperatureC,
  finish,
) {
  const finishMaxSurfaceT = finish.maxSurfaceTemperatureCelsius;
  const finishComfortMaxSurfaceT = finish.comfortMaxSurfaceTemperatureCelsius;

  const presetMax =
    typeof presetMaxSurfaceTemperatureC === 'number'
    && Number.isFinite(presetMaxSurfaceTemperatureC)
    && presetMaxSurfaceTemperatureC > 0
      ? presetMaxSurfaceTemperatureC
      : undefined;

  const appliedMaxSurfaceT =
    presetMax != null
      ? Math.min(presetMax, finishMaxSurfaceT)
      : finishMaxSurfaceT;

  const appliedComfortMaxSurfaceT =
    presetMax != null && typeof finishComfortMaxSurfaceT === 'number'
      ? Math.min(presetMax, finishComfortMaxSurfaceT)
      : finishComfortMaxSurfaceT;

  return {
    appliedMaxSurfaceT,
    appliedComfortMaxSurfaceT,
    finishMaxSurfaceT,
    ...(presetMax != null ? { presetMaxSurfaceT: presetMax } : {}),
  };
}

/**
 * @param {object} args
 * @param {import('../types/shared-types').UnderfloorHeatingBasePreset} args.base
 * @param {import('../types/shared-types').FlooringFinishMaterial} args.finish
 * @param {number} args.pipeSpacingMm
 * @param {number} args.circuitMeanC — средняя температура теплоносителя контура ТП
 * @param {number} [args.presetMaxSurfaceTemperatureC] — technical.maxSurfaceTemperatureC из underfloor_heating_presets
 * @param {number} args.insideC
 * @param {number} args.outsideC
 * @param {'heated' | 'unheated'} args.bottomBoundary
 * @param {number} args.areaM2
 * @returns {Omit<import('../types/shared-types').UnderfloorHeatingRoomReport, 'roomId' | 'roomName' | 'basePresetId' | 'finishMaterialId' | 'basePresetName' | 'finishMaterialName' | 'ufhCircuitPresetId' | 'roomHeatLossWatts' | 'heatFluxCoverageRatio' | 'warnings'> & { roomWarnings: string[] }}
 */
export function computeUfhRoomHeatFlux(args) {
  const {
    base,
    finish,
    pipeSpacingMm,
    circuitMeanC,
    circuitSupplyC,
    circuitReturnC,
    presetMaxSurfaceTemperatureC,
    insideC,
    outsideC,
    bottomBoundary,
    areaM2,
  } = args;

  const layers = base.layers;
  const heatingIdx = layers.findIndex((l) => l.isHeatingLayer);
  const rPipeEmbed = resolvePipeEmbedmentResistanceM2KW(pipeSpacingMm);
  const screedLayer = layers[heatingIdx];
  const rScreedHalf = computeLayerResistanceM2KW(screedLayer) / 2;
  const rBaseAbove = computeBaseCoveringResistanceM2KW(layers);
  const rFinish = computeFinishCoveringResistanceM2KW(finish);
  const rCovering = computeComposedCoveringResistanceM2KW(base, finish);
  const rBelow = sumResistanceBelowHeatingLayer(layers, heatingIdx);

  const rUp = rPipeEmbed + rScreedHalf + rCovering + R_CONV_UP_M2KW;
  const neighborTempC = bottomBoundary === 'heated' ? insideC : outsideC;
  const rConvDown =
    bottomBoundary === 'heated'
      ? R_CONV_DOWN_HEATED_M2KW
      : R_CONV_DOWN_UNHEATED_M2KW;
  const rDown = rPipeEmbed + rScreedHalf + rBelow + rConvDown;

  const surfaceLimits = resolveAppliedSurfaceTemperatureLimits(
    presetMaxSurfaceTemperatureC,
    finish,
  );
  const maxSurfaceT = surfaceLimits.appliedMaxSurfaceT;
  const comfortMaxSurfaceT = surfaceLimits.appliedComfortMaxSurfaceT;
  const maxAllowableHeatFluxUpWm2 = Math.max(0, (maxSurfaceT - insideC) / rFinish);

  const heatFluxUpUncappedWm2 = Math.max(0, (circuitMeanC - insideC) / rUp);
  const heatFluxUpLimitedBySurface =
    heatFluxUpUncappedWm2 > maxAllowableHeatFluxUpWm2 + 1e-9;
  const heatFluxUpWm2 = Math.min(heatFluxUpUncappedWm2, maxAllowableHeatFluxUpWm2);
  const heatFluxDownWm2 = Math.max(0, (circuitMeanC - neighborTempC) / rDown);
  const surfaceTempC = insideC + heatFluxUpWm2 * rFinish;

  const heatFluxUpWatts = heatFluxUpWm2 * areaM2;
  const heatFluxDownWatts = heatFluxDownWm2 * areaM2;

  /** @type {string[]} */
  const roomWarnings = [];
  if (heatFluxUpLimitedBySurface) {
    roomWarnings.push(
      `Отдача вверх ограничена лимитом поверхности ${round(maxSurfaceT, 1)} °C: q↑ снижен с ≈${round(heatFluxUpUncappedWm2, 0)} до ≈${round(heatFluxUpWm2, 0)} Вт/м² (Tповерх ≈${round(surfaceTempC, 1)} °C).`,
    );
  }
  if (bottomBoundary === 'heated' && heatFluxDownWm2 > 5) {
    roomWarnings.push(
      `Паразитный поток вниз ≈${round(heatFluxDownWm2, 0)} Вт/м² (${round(heatFluxDownWatts, 0)} Вт) — прогрев плиты перекрытия.`,
    );
  }

  return {
    areaM2,
    pipeSpacingMm,
    pipeEmbedmentResistanceM2KW: round(rPipeEmbed, 3),
    baseCoveringResistanceM2KW: round(rBaseAbove, 4),
    finishCoveringResistanceM2KW: round(rFinish, 4),
    coveringResistanceM2KW: round(rCovering, 4),
    resistanceUpM2KW: round(rUp, 4),
    resistanceDownM2KW: round(rDown, 4),
    circuitSupplyC,
    circuitReturnC,
    circuitMeanC: round(circuitMeanC, 1),
    heatFluxUpWm2: round(heatFluxUpWm2, 1),
    heatFluxDownWm2: round(heatFluxDownWm2, 1),
    maxAllowableHeatFluxUpWm2: round(maxAllowableHeatFluxUpWm2, 1),
    heatFluxUpWatts: round(heatFluxUpWatts, 0),
    heatFluxDownWatts: round(heatFluxDownWatts, 0),
    surfaceTempC: round(surfaceTempC, 1),
    /** Фактический лимит расчёта (min пресета БД и паспорта финиша). */
    maxSurfaceTemperatureCelsius: maxSurfaceT,
    comfortMaxSurfaceTemperatureCelsius: comfortMaxSurfaceT,
    finishMaxSurfaceTemperatureCelsius: surfaceLimits.finishMaxSurfaceT,
    ...(surfaceLimits.presetMaxSurfaceT != null
      ? { presetMaxSurfaceTemperatureCelsius: surfaceLimits.presetMaxSurfaceT }
      : {}),
    bottomBoundary,
    neighborTempC: round(neighborTempC, 1),
    heatFluxUpLimitedBySurface,
    roomWarnings,
  };
}
