/**
 * Назначение: пояснения и рекомендации по водяному тёплому полу.
 * Описание: matching-заметки и структурированные WARN/REC через recommendationResolver.
 */

import { pushRecommendation } from '../recommendations/recommendationResolver.js';

/** Финиши с лимитом материала 27 °C (деформация покрытия). */
const MATERIAL_LIMIT_FINISH_IDS = new Set([
  'pvc_glue',
  'pvc_click',
  'laminate_click',
]);

const SURFACE_TEMP_EPSILON_C = 0.05;
const SUGGESTED_MAX_PIPE_SPACING_MM = 200;

/**
 * Текстовые подсказки для отчёта подбора, если в анкете отмечен водяной тёплый пол.
 *
 * @param {import('../types/shared-types.js').HeatingSystemInput | undefined | null} heatingSystem
 * @returns {string[]}
 */
export function buildWarmFloorMatchingNotes(heatingSystem) {
  if (!heatingSystem?.waterUnderfloorHeating) return [];
  return [
    'Указан водяной тёплый пол: контур пола 45/35 °C (плитка) или 40/30 °C (ламинат/винил) задаётся по финишу комнаты. ' +
      'Если подача котла (75/65 или 55/45) выше температуры контура ТП — нужен насосно-смесительный узел; ' +
      'при совпадении температур (только ТП) смеситель не требуется.',
  ];
}

/**
 * Подсказки с расчётными цифрами ТП (warmFloorCalc).
 *
 * @param {import('../types/shared-types.js').UnderfloorHeatingReport | null | undefined} report
 * @returns {string[]}
 */
export function buildWarmFloorCalcMatchingNotes(report) {
  if (!report?.rooms?.length) return [];

  const notes = report.rooms.map((room) => {
    const finish = room.finishMaterialName ?? room.finishMaterialId ?? '—';
    const step = room.pipeSpacingMm ?? 150;
    return `ТП «${room.roomName}» (${finish}, шаг ${step} мм): q↑≈${room.heatFluxUpWm2} Вт/м² (${room.heatFluxUpWatts} Вт), Tповерх≈${room.surfaceTempC} °C (лимит ${room.maxSurfaceTemperatureCelsius} °C), Rфиниш=${room.finishCoveringResistanceM2KW} м²·K/Вт.`;
  });

  if (report.totalHeatFluxUpWatts > 0) {
    notes.push(
      `Суммарная полезная отдача ТП вверх: ≈${report.totalHeatFluxUpWatts} Вт; паразитный поток вниз: ≈${report.totalHeatFluxDownWatts} Вт (контур ${report.circuitSupplyC}/${report.circuitReturnC} °C).`,
    );
  }

  return notes;
}

/**
 * @param {import('../types/shared-types.js').UnderfloorHeatingRoomReport} room
 * @returns {Record<string, string | number | undefined>}
 */
function recommendationVarsForRoom(room) {
  const coveragePercent =
    typeof room.heatFluxCoverageRatio === 'number'
      ? Math.round(room.heatFluxCoverageRatio * 100)
      : undefined;

  return {
    roomName: room.roomName,
    surfaceTempC: room.surfaceTempC,
    maxTempC: room.maxSurfaceTemperatureCelsius,
    comfortMaxTempC: room.comfortMaxSurfaceTemperatureCelsius,
    finishName: room.finishMaterialName ?? room.finishMaterialId,
    circuitSupplyC: room.circuitSupplyC,
    circuitReturnC: room.circuitReturnC,
    heatFluxUpWm2: room.heatFluxUpWm2,
    maxAllowableHeatFluxUpWm2: room.maxAllowableHeatFluxUpWm2,
    pipeSpacingMm: room.pipeSpacingMm,
    requestedPipeSpacingMm: room.requestedPipeSpacingMm,
    resolvedPipeSpacingMm: room.resolvedPipeSpacingMm,
    suggestedPipeSpacingMm: SUGGESTED_MAX_PIPE_SPACING_MM,
    roomAreaM2: room.roomAreaM2,
    furnitureOccupiedAreaM2: room.furnitureOccupiedAreaM2,
    heatedAreaM2: room.heatedAreaM2,
    requiredHeatFluxUpWm2: room.requiredHeatFluxUpWm2,
    heatFluxUpWatts: room.heatFluxUpWatts,
    roomHeatLossWatts: room.roomHeatLossWatts,
    coveragePercent,
  };
}

/**
 * @param {import('../types/shared-types.js').UnderfloorHeatingRoomReport} room
 * @param {string[]} warnings
 * @param {import('../recommendations/types.js').ResolvedRecommendation[]} resolvedList
 * @param {import('../recommendations/types.js').RecommendationsBundle} recommendations
 * @param {string} code
 * @param {Record<string, string | number | undefined>} vars
 */
function pushUfhRecommendation(room, warnings, resolvedList, recommendations, code, vars) {
  const resolved = pushRecommendation(warnings, resolvedList, recommendations, code, vars);
  if (resolved?.category === 'warnings' && resolved.text) {
    room.warnings = [...(room.warnings ?? []), resolved.text];
  }
}

/**
 * Структурированные WARN/REC по перегреву поверхности; дополняет report на месте.
 *
 * @param {import('../types/shared-types.js').UnderfloorHeatingReport | null | undefined} report
 * @param {import('../recommendations/types.js').RecommendationsBundle} recommendations
 * @returns {{ warnings: string[], resolvedRecommendations: import('../recommendations/types.js').ResolvedRecommendation[] }}
 */
export function applyUnderfloorHeatingRecommendations(report, recommendations) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {import('../recommendations/types.js').ResolvedRecommendation[]} */
  const resolvedRecommendations = [];

  if (!report?.rooms?.length) {
    return { warnings, resolvedRecommendations };
  }

  for (const room of report.rooms) {
    const vars = recommendationVarsForRoom(room);

    if (room.activeAreaCheckStatus === 'zero_heated_area') {
      pushUfhRecommendation(
        room,
        warnings,
        resolvedRecommendations,
        recommendations,
        'WARN_UFH_HEATED_AREA_ZERO',
        vars,
      );
    } else if (room.activeAreaCheckStatus === 'insufficient_active_area') {
      pushUfhRecommendation(
        room,
        warnings,
        resolvedRecommendations,
        recommendations,
        'WARN_UFH_ACTIVE_AREA_INSUFFICIENT',
        vars,
      );
    }

    if (room.heatFluxCoverageStatus === 'low') {
      pushUfhRecommendation(
        room,
        warnings,
        resolvedRecommendations,
        recommendations,
        'WARN_UFH_COVERAGE_LOW',
        vars,
      );
    }

    if (
      room.pipeSpacingResolution === 'tightened'
      && typeof room.requestedPipeSpacingMm === 'number'
      && typeof room.resolvedPipeSpacingMm === 'number'
      && room.requestedPipeSpacingMm !== room.resolvedPipeSpacingMm
    ) {
      pushRecommendation(
        warnings,
        resolvedRecommendations,
        recommendations,
        'REC_UFH_PIPE_SPACING_AUTO',
        vars,
      );
    }

    const presetMax = room.presetMaxSurfaceTemperatureCelsius;
    const finishMax = room.finishMaxSurfaceTemperatureCelsius;
    if (
      typeof presetMax === 'number'
      && Number.isFinite(presetMax)
      && typeof finishMax === 'number'
      && Number.isFinite(finishMax)
      && finishMax > presetMax
    ) {
      pushUfhRecommendation(
        room,
        warnings,
        resolvedRecommendations,
        recommendations,
        'WARN_UFH_SURFACE_TEMP_PRESET_OVERRIDE',
        {
          roomName: room.roomName,
          finishName: room.finishMaterialName ?? room.finishMaterialId,
          presetMaxTempC: presetMax,
          finishMaxTempC: finishMax,
        },
      );
    }

    const materialOverheat =
      MATERIAL_LIMIT_FINISH_IDS.has(room.finishMaterialId) &&
      (room.surfaceTempC >
        room.maxSurfaceTemperatureCelsius + SURFACE_TEMP_EPSILON_C
        || room.heatFluxUpLimitedBySurface === true);

    const comfortLimit = room.comfortMaxSurfaceTemperatureCelsius;
    const comfortOverheat =
      !MATERIAL_LIMIT_FINISH_IDS.has(room.finishMaterialId) &&
      typeof comfortLimit === 'number' &&
      Number.isFinite(comfortLimit) &&
      (room.surfaceTempC > comfortLimit + SURFACE_TEMP_EPSILON_C
        || room.heatFluxUpLimitedBySurface === true);

    if (materialOverheat) {
      pushUfhRecommendation(
        room,
        warnings,
        resolvedRecommendations,
        recommendations,
        'WARN_FLOOR_OVERHEATING_MATERIAL',
        vars,
      );
      if (
        typeof room.pipeSpacingMm === 'number' &&
        room.pipeSpacingMm < SUGGESTED_MAX_PIPE_SPACING_MM
      ) {
        pushRecommendation(
          warnings,
          resolvedRecommendations,
          recommendations,
          'REC_UFH_ACTION_INCREASE_SPACING',
          vars,
        );
      }
      if (
        room.finishMaterialId === 'laminate_click' ||
        room.finishMaterialId === 'pvc_click'
      ) {
        pushRecommendation(
          warnings,
          resolvedRecommendations,
          recommendations,
          'REC_UFH_ACTION_CHANGE_FINISH',
          vars,
        );
      }
    } else if (comfortOverheat) {
      pushUfhRecommendation(
        room,
        warnings,
        resolvedRecommendations,
        recommendations,
        'WARN_FLOOR_OVERHEATING_COMFORT',
        {
          ...vars,
          maxTempC: comfortLimit,
        },
      );
      if (
        typeof room.pipeSpacingMm === 'number' &&
        room.pipeSpacingMm < SUGGESTED_MAX_PIPE_SPACING_MM
      ) {
        pushRecommendation(
          warnings,
          resolvedRecommendations,
          recommendations,
          'REC_UFH_ACTION_INCREASE_SPACING',
          vars,
        );
      }
    }
  }

  if (warnings.length > 0) {
    report.warnings = [...(report.warnings ?? []), ...warnings];
  }
  if (resolvedRecommendations.length > 0) {
    report.resolvedRecommendations = [
      ...(report.resolvedRecommendations ?? []),
      ...resolvedRecommendations,
    ];
  }

  return { warnings, resolvedRecommendations };
}

/**
 * REC/WARN по смесительному узлу и авто-схеме распределения (фаза 7).
 *
 * @param {import('../types/shared-types.js').UnderfloorHeatingReport} report
 * @param {object} ctx
 * @param {import('../types/shared-types.js').UfhDistributionPreset | undefined | null} ctx.requestedPreset
 * @param {Exclude<import('../types/shared-types.js').UfhDistributionPreset, 'auto'>} ctx.resolvedPreset
 * @param {number} ctx.minBoilerKw
 * @param {number | undefined} ctx.requiredBoilerKw
 * @param {import('../recommendations/types.js').RecommendationsBundle} recommendations
 */
export function applyUnderfloorMixingDistributionRecommendations(
  report,
  ctx,
  recommendations,
) {
  if (!report?.isMixingNodeRequired) return;

  /** @type {string[]} */
  const warnings = [];
  /** @type {import('../recommendations/types.js').ResolvedRecommendation[]} */
  const resolvedRecommendations = [];

  const mixing = report.mixingNode;
  const vars = {
    boilerSupplyC: mixing?.boilerSupplyC ?? report.circuitSupplyC,
    floorCircuitSupplyC: mixing?.floorCircuitSupplyC ?? report.circuitSupplyC,
    flowRateM3PerHour: mixing?.flowRateM3PerHour,
    headMetersMin: mixing?.headMetersMin,
    valveKvsMin: mixing?.valveKvsMin,
    distributionPreset: ctx.resolvedPreset,
    requiredBoilerKw: ctx.requiredBoilerKw,
    minBoilerKw: ctx.minBoilerKw,
  };

  pushRecommendation(
    warnings,
    resolvedRecommendations,
    recommendations,
    'WARN_UFH_MIXING_NODE_REQUIRED',
    vars,
  );

  if (
    (ctx.requestedPreset === 'auto' || ctx.requestedPreset == null) &&
    ctx.resolvedPreset === 'hydraulic_separator' &&
    typeof ctx.requiredBoilerKw === 'number' &&
    ctx.requiredBoilerKw > ctx.minBoilerKw
  ) {
    pushRecommendation(
      warnings,
      resolvedRecommendations,
      recommendations,
      'REC_UFH_HYDRAULIC_SEPARATOR_AUTO',
      vars,
    );
  }

  if (warnings.length > 0) {
    report.warnings = [...(report.warnings ?? []), ...warnings];
  }
  if (resolvedRecommendations.length > 0) {
    report.resolvedRecommendations = [
      ...(report.resolvedRecommendations ?? []),
      ...resolvedRecommendations,
    ];
  }
}
