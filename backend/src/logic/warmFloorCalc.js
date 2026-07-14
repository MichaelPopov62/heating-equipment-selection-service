/**
 * Назначение: оркестратор расчёта водяного тёплого пола по комнатам.
 * Описание: Пресет контура по финишу, смеситель, S_акт, авто-шаг, ufhRoomHeatFlux.
 */

import { resolveUnderfloorHeatingComposition } from '../data/warmFloorAssemblyPresets.js';
import { DEFAULT_PIPE_SPACING_MM } from './ufhPipeEmbedment.js';
import { resolveUfhCircuitForFinish } from './ufhCircuitResolve.js';
import { isMixingNodeRequiredForProject } from './ufhMixingNode.js';
import { resolveUfhDistributionPreset } from '../../../shared/ufhDistributionPresets.js';
import { UFH_PRESET_MIXED_RADIATORS } from '../../../shared/ufhModePresetIds.js';
import { computeUfhMixingNodeSpec } from './ufhMixingNodeHydraulics.js';
import { computeUnderfloorHydraulicsCircuit } from './ufhHydraulicsCircuit.js';
import { computeUfhLoopGeometry } from './ufhLoopGeometry.js';
import { computeUfhRoomHeatFlux } from './ufhRoomHeatFlux.js';
import { resolveUfhActiveFloorAreaM2 } from './ufhActiveFloorArea.js';
import { computeUfhRequiredHeatFluxUpWm2 } from './ufhRequiredHeatFlux.js';
import { resolveUfhPipeSpacingMm } from './ufhPipeSpacingResolve.js';
import {
  assessUfhActiveAreaHeatFlux,
  assessUfhRoomHeatLossCoverage,
  resolveRoomDesignHeatLossWatts,
} from './ufhRoomCoverageCheck.js';
import { round } from '../utils/math.js';
import { resolveDesignRoomAirTempC } from '../../../shared/roomDesignAirTemp.js';

/**
 * @param {object} args
 * @param {{ insideC: number, outsideC: number, bathroomAirTempC?: number }} args.temps
 * @param {import('../types/shared-types.js').BuildingInput | undefined | null} args.building
 * @param {import('../types/shared-types.js').HeatingSystemInput | undefined | null} args.heatingSystem
 * @param {import('../types/shared-types.js').HeatLossReport | undefined | null} [args.heatLoss]
 * @param {import('../ufh/types.js').UnderfloorHeatingPresetsBundle} args.ufhPresets
 * @param {number} [args.maxUfhLoopLengthM]
 * @param {number} [args.ufhLoopLengthLayoutFactor]
 * @returns {import('../types/shared-types.js').UnderfloorHeatingReport | null}
 */
export function calculateUnderfloorHeating(args) {
  const {
    temps,
    building,
    heatingSystem,
    heatLoss,
    ufhPresets,
    maxUfhLoopLengthM = 80,
    ufhLoopLengthLayoutFactor = 1.1,
  } = args;

  if (!ufhPresets?.byPresetId) {
    throw new Error('Расчёт ТП: ufhPresets обязательны.');
  }

  if (!heatingSystem?.waterUnderfloorHeating && !heatingSystem?.ufhPresetId) {
    return null;
  }

  const ufhPresetId =
    typeof heatingSystem?.ufhPresetId === 'string'
      ? heatingSystem.ufhPresetId.trim()
      : '';
  /** @type {import('../ufh/types.js').NormalizedUfhModePreset | null} */
  let modePreset = null;
  if (ufhPresetId) {
    modePreset = ufhPresets.byPresetId[ufhPresetId] ?? null;
    if (!modePreset) {
      const err = new Error(
        `Неизвестный ufhPresetId "${ufhPresetId}" в расчёте ТП.`,
      );
      /** @type {Error & import('../types/shared-types.js').AppErrorLike} */
      const appErr = err;
      appErr.statusCode = 400;
      appErr.code = 'UFH_PRESET_INVALID';
      throw appErr;
    }
  }

  const rooms = building?.rooms ?? [];
  const boilerSupplyC = heatingSystem.supplyC;
  const surveyInsideC = temps.insideC;
  const bathroomAirTempC =
    typeof temps.bathroomAirTempC === 'number' &&
    Number.isFinite(temps.bathroomAirTempC)
      ? temps.bathroomAirTempC
      : typeof building?.temps?.bathroomAirTempC === 'number' &&
          Number.isFinite(building.temps.bathroomAirTempC)
        ? building.temps.bathroomAirTempC
        : undefined;
  const isUfhOnly = heatingSystem?.heatingEmittersMode === 'ufh_only';

  /** @type {import('../types/shared-types.js').UnderfloorHeatingRoomReport[]} */
  const roomReports = [];
  /** @type {string[]} */
  const globalWarnings = [];

  for (const room of rooms) {
    const composed = resolveUnderfloorHeatingComposition(
      room.underfloorHeating,
    );
    if (!composed) continue;

    const { basePresetId, finishMaterialId, base, finish } = composed;
    let circuitResolved = resolveUfhCircuitForFinish(finishMaterialId);
    if (
      isUfhOnly &&
      typeof heatingSystem.supplyC === 'number' &&
      typeof heatingSystem.returnC === 'number'
    ) {
      circuitResolved = {
        preset: {
          id: 'ufh_dt10_40_30',
          supplyC: heatingSystem.supplyC,
          returnC: heatingSystem.returnC,
          deltaTK: heatingSystem.supplyC - heatingSystem.returnC,
          finishMaterialIds: [finishMaterialId],
          label: 'График из режима ufh_only',
        },
        source: 'finish_preset',
      };
    }
    if (!circuitResolved) {
      globalWarnings.push(
        `Комната «${room.name}»: для финиша «${finishMaterialId}» не задан пресет контура ТП.`,
      );
      continue;
    }

    const { preset } = circuitResolved;
    const circuitMeanC = (preset.supplyC + preset.returnC) / 2;
    const requestedPipeSpacingMm =
      room.underfloorHeating?.pipeSpacingMm ?? DEFAULT_PIPE_SPACING_MM;
    const bottomBoundary =
      room.bottomBoundary ?? base.bottomBoundary ?? 'heated';

    const areaResolved = resolveUfhActiveFloorAreaM2({
      roomAreaM2: room.areaM2,
      ...(room.underfloorHeating?.furnitureOccupiedAreaM2 !== undefined
        ? {
            furnitureOccupiedAreaM2:
              room.underfloorHeating.furnitureOccupiedAreaM2,
          }
        : {}),
    });
    const { roomAreaM2, furnitureOccupiedAreaM2, heatedAreaM2 } = areaResolved;

    const heatingIdx = base.layers.findIndex(
      (/** @type {import('../types/shared-types.js').UnderfloorHeatingAssemblyLayer} */ l) =>
        l.isHeatingLayer,
    );
    if (heatingIdx < 0) {
      globalWarnings.push(
        `Комната «${room.name}»: в базе ТП нет слоя isHeatingLayer.`,
      );
      continue;
    }

    const presetMaxSurfaceT = modePreset?.technical?.maxSurfaceTemperatureC;
    const roomHeatLossWatts = resolveRoomDesignHeatLossWatts(heatLoss, room.id);
    const airResolved = resolveDesignRoomAirTempC({
      roomType: room.type,
      insideC: surveyInsideC,
      ...(bathroomAirTempC !== undefined ? { bathroomAirTempC } : {}),
    });
    const insideC = airResolved?.designAirTempC ?? surveyInsideC;

    const requiredHeatFluxUpWm2 = computeUfhRequiredHeatFluxUpWm2({
      roomHeatLossWatts,
      heatedAreaM2,
    });

    const fluxContext = {
      base,
      finish,
      circuitMeanC,
      circuitSupplyC: preset.supplyC,
      circuitReturnC: preset.returnC,
      presetMaxSurfaceTemperatureC: presetMaxSurfaceT,
      insideC,
      outsideC: temps.outsideC,
      bottomBoundary,
    };

    const spacingResolved = resolveUfhPipeSpacingMm({
      requestedPipeSpacingMm,
      qRequiredWm2: requiredHeatFluxUpWm2,
      fluxContext,
    });

    const flux = computeUfhRoomHeatFlux({
      ...fluxContext,
      pipeSpacingMm: spacingResolved.resolvedPipeSpacingMm,
      areaM2: heatedAreaM2,
    });

    const activeAreaCheck = assessUfhActiveAreaHeatFlux({
      heatedAreaM2,
      qRequiredWm2: requiredHeatFluxUpWm2,
      maxAllowableHeatFluxUpWm2: flux.maxAllowableHeatFluxUpWm2,
    });

    const coverage = assessUfhRoomHeatLossCoverage({
      heatFluxUpWatts: flux.heatFluxUpWatts,
      roomHeatLossWatts,
    });

    const loopGeom = computeUfhLoopGeometry({
      areaM2: heatedAreaM2,
      pipeSpacingMm: spacingResolved.resolvedPipeSpacingMm,
      heatLoadWatts: flux.heatFluxUpWatts,
      deltaTK: 10,
      maxLoopLengthM: maxUfhLoopLengthM,
      layoutFactor: ufhLoopLengthLayoutFactor,
      roomId: room.id,
    });

    const roomWarnings = flux.roomWarnings.map(
      (w) => `Комната «${room.name}»: ${w}`,
    );

    /** @type {import('../types/shared-types.js').UfhTerminalControl} */
    const ufhTerminalControl =
      room.underfloorHeating?.ufhTerminalControl === 'unibox'
        ? 'unibox'
        : 'collector';

    /** @type {import('../types/shared-types.js').UnderfloorHeatingRoomReport} */
    const roomReport = {
      roomId: room.id,
      roomName: room.name,
      basePresetId,
      finishMaterialId,
      basePresetName: base.name,
      finishMaterialName: finish.name,
      ufhCircuitPresetId: preset.id,
      designAirTempC: insideC,
      designAirTempSource: airResolved?.source ?? 'survey',
      roomAreaM2,
      furnitureOccupiedAreaM2,
      heatedAreaM2,
      requestedPipeSpacingMm: spacingResolved.requestedPipeSpacingMm,
      resolvedPipeSpacingMm: spacingResolved.resolvedPipeSpacingMm,
      pipeSpacingResolution: spacingResolved.pipeSpacingResolution,
      areaM2: heatedAreaM2,
      pipeSpacingMm: spacingResolved.resolvedPipeSpacingMm,
      pipeEmbedmentResistanceM2KW: flux.pipeEmbedmentResistanceM2KW,
      baseCoveringResistanceM2KW: flux.baseCoveringResistanceM2KW,
      finishCoveringResistanceM2KW: flux.finishCoveringResistanceM2KW,
      coveringResistanceM2KW: flux.coveringResistanceM2KW,
      resistanceUpM2KW: flux.resistanceUpM2KW,
      resistanceDownM2KW: flux.resistanceDownM2KW,
      circuitSupplyC: flux.circuitSupplyC,
      circuitReturnC: flux.circuitReturnC,
      circuitMeanC: flux.circuitMeanC,
      heatFluxUpWm2: flux.heatFluxUpWm2,
      heatFluxDownWm2: flux.heatFluxDownWm2,
      maxAllowableHeatFluxUpWm2: flux.maxAllowableHeatFluxUpWm2,
      heatFluxUpWatts: flux.heatFluxUpWatts,
      heatFluxDownWatts: flux.heatFluxDownWatts,
      surfaceTempC: flux.surfaceTempC,
      maxSurfaceTemperatureCelsius: flux.maxSurfaceTemperatureCelsius,
      bottomBoundary: flux.bottomBoundary,
      neighborTempC: flux.neighborTempC,
      heatFluxUpLimitedBySurface: flux.heatFluxUpLimitedBySurface,
      warnings: roomWarnings,
    };
    roomReport.pipeMetersPerSqM = loopGeom.pipeMetersPerSqM;
    roomReport.loopLengthLayoutFactor = loopGeom.layoutFactor;
    roomReport.ufhTerminalControl = ufhTerminalControl;
    roomReport.heatLoadWatts = flux.heatFluxUpWatts;
    roomReport.flowRateM3PerHour = loopGeom.flowRateM3PerHour;
    roomReport.loopsCount = loopGeom.loopsCount;
    roomReport.loops = loopGeom.loops;
    roomReport.heatFluxCoverageStatus = coverage.coverageStatus;
    roomReport.activeAreaCheckStatus = activeAreaCheck.status;
    roomReport.finishMaxSurfaceTemperatureCelsius =
      flux.finishMaxSurfaceTemperatureCelsius;
    if (requiredHeatFluxUpWm2 != null) {
      roomReport.requiredHeatFluxUpWm2 = requiredHeatFluxUpWm2;
    }
    if (roomHeatLossWatts != null) {
      roomReport.roomHeatLossWatts = roomHeatLossWatts;
    }
    if (coverage.heatFluxCoverageRatio != null) {
      roomReport.heatFluxCoverageRatio = coverage.heatFluxCoverageRatio;
    }
    if (flux.comfortMaxSurfaceTemperatureCelsius !== undefined) {
      roomReport.comfortMaxSurfaceTemperatureCelsius =
        flux.comfortMaxSurfaceTemperatureCelsius;
    }
    if (flux.presetMaxSurfaceTemperatureCelsius != null) {
      roomReport.presetMaxSurfaceTemperatureCelsius =
        flux.presetMaxSurfaceTemperatureCelsius;
    }
    roomReports.push(roomReport);
  }

  if (roomReports.length === 0) {
    globalWarnings.push(
      'Водяной тёплый пол включён в анкете, но ни в одной комнате не заданы basePresetId и finishMaterialId.',
    );
  }

  let mixingRequired = false;
  if (modePreset?.technical.hasMixingNode === false) {
    if (roomReports.length > 0) {
      globalWarnings.push(
        `Смесительный узел не требуется по пресету режима ТП «${modePreset.ui.title}» (прямое подключение).`,
      );
    }
  } else {
    mixingRequired = isMixingNodeRequiredForProject(boilerSupplyC, roomReports);
  }

  const objectType = building?.objectMeta?.objectType;
  const distributionPreset = mixingRequired
    ? resolveUfhDistributionPreset(
        heatingSystem?.underfloorDistributionPreset,
        {
          ...(objectType !== undefined ? { objectType } : {}),
          roomsWithUfhCount: roomReports.length,
        },
      )
    : undefined;

  if (mixingRequired) {
    globalWarnings.push(
      `Требуется насосно-смесительный узел: подача котла ${boilerSupplyC ?? '—'} °C выше температуры контура ТП ` +
        `(по комнатам ${roomReports.map((r) => `${r.circuitSupplyC}/${r.circuitReturnC}`).join(', ')} °C).`,
    );
  } else if (roomReports.length > 0 && typeof boilerSupplyC === 'number') {
    globalWarnings.push(
      `Смесительный узел не требуется: подача котла ${boilerSupplyC} °C не выше подачи контура ТП.`,
    );
  }

  const primaryRoom = roomReports[0];
  const circuitSource =
    modePreset?.presetId === UFH_PRESET_MIXED_RADIATORS
      ? 'finish_preset'
      : modePreset
        ? 'ufh_mode_preset'
        : primaryRoom
          ? 'finish_preset'
          : 'mixed_default';

  const totalHeatFluxUpWatts = round(
    roomReports.reduce((s, r) => s + r.heatFluxUpWatts, 0),
    0,
  );
  const totalHeatFluxDownWatts = round(
    roomReports.reduce((s, r) => s + r.heatFluxDownWatts, 0),
    0,
  );

  const underfloorHydraulics = computeUnderfloorHydraulicsCircuit({
    heatLoadWatts: totalHeatFluxUpWatts,
    deltaTK: 10,
  });

  /** @type {import('../types/shared-types.js').UfhMixingNodeSpec | null} */
  let mixingNode = null;
  if (mixingRequired && distributionPreset) {
    mixingNode = computeUfhMixingNodeSpec({
      powerKw: totalHeatFluxUpWatts / 1000,
      deltaTK: 10,
      distributionPreset,
    });
    if (boilerSupplyC !== undefined) {
      mixingNode.boilerSupplyC = boilerSupplyC;
    }
    if (primaryRoom?.circuitSupplyC !== undefined) {
      mixingNode.floorCircuitSupplyC = primaryRoom.circuitSupplyC;
    }
  }

  const allRoomWarnings = roomReports.flatMap((r) => r.warnings);

  return {
    enabled: true,
    circuitSupplyC: primaryRoom?.circuitSupplyC ?? 45,
    circuitReturnC: primaryRoom?.circuitReturnC ?? 35,
    circuitMeanC: primaryRoom?.circuitMeanC ?? 40,
    circuitSource,
    isMixingNodeRequired: mixingRequired,
    ...(distributionPreset !== undefined ? { distributionPreset } : {}),
    ...(mixingNode != null ? { mixingNode } : {}),
    underfloorHydraulics,
    rooms: roomReports,
    totalHeatFluxUpWatts,
    totalHeatFluxDownWatts,
    warnings: [...globalWarnings, ...allRoomWarnings],
  };
}
