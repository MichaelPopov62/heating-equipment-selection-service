/**
 * Назначение: оркестратор расчёта водяного тёплого пола по комнатам.
 * Описание: Пресет контура по финишу, смеситель, делегирование в ufhRoomHeatFlux / ufhRoomCoverageCheck.
 */

import { resolveUnderfloorHeatingComposition } from '../data/warmFloorAssemblyPresets.js';
import { DEFAULT_PIPE_SPACING_MM } from './ufhPipeEmbedment.js';
import { resolveUfhCircuitForFinish } from './ufhCircuitResolve.js';
import { isMixingNodeRequiredForProject } from './ufhMixingNode.js';
import { getUfhPresets } from '../ufh/ufhPresetsCache.js';
import { resolveUfhDistributionPreset } from '../../../shared/ufhDistributionPresets.js';
import {
  UFH_PRESET_MIXED_RADIATORS,
  ufhModePresetOverridesFinishCircuit,
} from '../../../shared/ufhModePresetIds.js';
import { computeUfhMixingNodeSpec } from './ufhMixingNodeHydraulics.js';
import { computeUnderfloorHydraulicsCircuit } from './ufhHydraulicsCircuit.js';
import { computeUfhRoomHeatFlux } from './ufhRoomHeatFlux.js';
import {
  assessUfhRoomHeatLossCoverage,
  resolveRoomDesignHeatLossWatts,
} from './ufhRoomCoverageCheck.js';
import { round } from '../utils/math.js';

/**
 * @param {object} args
 * @param {{ insideC: number, outsideC: number }} args.temps
 * @param {import('../types/shared-types').BuildingInput | undefined | null} args.building
 * @param {import('../types/shared-types').HeatingSystemInput | undefined | null} args.heatingSystem
 * @param {import('../types/shared-types').HeatLossReport | undefined | null} [args.heatLoss]
 * @returns {import('../types/shared-types').UnderfloorHeatingReport | null}
 */
export function calculateUnderfloorHeating(args) {
  const { temps, building, heatingSystem, heatLoss } = args;

  if (!heatingSystem?.waterUnderfloorHeating && !heatingSystem?.ufhPresetId) {
    return null;
  }

  const ufhPresetId =
    typeof heatingSystem?.ufhPresetId === 'string'
      ? heatingSystem.ufhPresetId.trim()
      : '';
  /** @type {import('../ufh/types').NormalizedUfhModePreset | null} */
  let modePreset = null;
  if (ufhPresetId) {
    try {
      modePreset = getUfhPresets().byPresetId[ufhPresetId] ?? null;
    } catch {
      modePreset = null;
    }
  }

  const rooms = building?.rooms ?? [];
  const boilerSupplyC = heatingSystem.supplyC;
  const insideC = temps.insideC;
  const isUfhOnly = heatingSystem?.heatingEmittersMode === 'ufh_only';

  /** @type {import('../types/shared-types').UnderfloorHeatingRoomReport[]} */
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
    if (modePreset && ufhModePresetOverridesFinishCircuit(modePreset.presetId)) {
      const tech = modePreset.technical;
      const circuitPresetId =
        tech.supplyC >= 45 ? 'ufh_dt10_45_35' : 'ufh_dt10_40_30';
      circuitResolved = {
        preset: {
          id: circuitPresetId,
          supplyC: tech.supplyC,
          returnC: tech.returnC,
        },
        finishMaterialId,
      };
    } else if (
      isUfhOnly
      && typeof heatingSystem.supplyC === 'number'
      && typeof heatingSystem.returnC === 'number'
    ) {
      // Fallback: график 40/30 из normalizeHeatingUfhPreset, если кэш пресета недоступен
      circuitResolved = {
        preset: {
          id: 'ufh_dt10_40_30',
          supplyC: heatingSystem.supplyC,
          returnC: heatingSystem.returnC,
        },
        finishMaterialId,
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
    const pipeSpacingMm =
      room.underfloorHeating?.pipeSpacingMm ?? DEFAULT_PIPE_SPACING_MM;
    const bottomBoundary =
      room.bottomBoundary ?? base.bottomBoundary ?? 'heated';
    const areaM2 = room.areaM2;

    const heatingIdx = base.layers.findIndex((l) => l.isHeatingLayer);
    if (heatingIdx < 0) {
      globalWarnings.push(
        `Комната «${room.name}»: в базе ТП нет слоя isHeatingLayer.`,
      );
      continue;
    }

    const presetMaxSurfaceT = modePreset?.technical?.maxSurfaceTemperatureC;

    const flux = computeUfhRoomHeatFlux({
      base,
      finish,
      pipeSpacingMm,
      circuitMeanC,
      circuitSupplyC: preset.supplyC,
      circuitReturnC: preset.returnC,
      presetMaxSurfaceTemperatureC: presetMaxSurfaceT,
      insideC,
      outsideC: temps.outsideC,
      bottomBoundary,
      areaM2,
    });

    const roomHeatLossWatts = resolveRoomDesignHeatLossWatts(heatLoss, room.id);
    const coverage = assessUfhRoomHeatLossCoverage({
      roomName: room.name,
      heatFluxUpWatts: flux.heatFluxUpWatts,
      roomHeatLossWatts,
    });

    const roomWarnings = [
      ...flux.roomWarnings.map((w) => `Комната «${room.name}»: ${w}`),
      ...coverage.warnings,
    ];

    roomReports.push({
      roomId: room.id,
      roomName: room.name,
      basePresetId,
      finishMaterialId,
      basePresetName: base.name,
      finishMaterialName: finish.name,
      ufhCircuitPresetId: preset.id,
      areaM2: flux.areaM2,
      pipeSpacingMm: flux.pipeSpacingMm,
      pipeEmbedmentResistanceM2KW: flux.pipeEmbedmentResistanceM2KW,
      baseCoveringResistanceM2KW: flux.baseCoveringResistanceM2KW,
      finishCoveringResistanceM2KW: flux.finishCoveringResistanceM2KW,
      coveringResistanceM2KW: flux.coveringResistanceM2KW,
      resistanceUpM2KW: flux.resistanceUpM2KW,
      resistanceDownM2KW: flux.resistanceDownM2KW,
      circuitSupplyC: flux.circuitSupplyC,
      circuitReturnC: flux.circuitReturnC,
      circuitMeanC: flux.circuitMeanC,
      roomHeatLossWatts: roomHeatLossWatts ?? undefined,
      heatFluxCoverageRatio: coverage.heatFluxCoverageRatio ?? undefined,
      heatFluxUpWm2: flux.heatFluxUpWm2,
      heatFluxDownWm2: flux.heatFluxDownWm2,
      maxAllowableHeatFluxUpWm2: flux.maxAllowableHeatFluxUpWm2,
      heatFluxUpWatts: flux.heatFluxUpWatts,
      heatFluxDownWatts: flux.heatFluxDownWatts,
      surfaceTempC: flux.surfaceTempC,
      maxSurfaceTemperatureCelsius: flux.maxSurfaceTemperatureCelsius,
      comfortMaxSurfaceTemperatureCelsius:
        flux.comfortMaxSurfaceTemperatureCelsius,
      finishMaxSurfaceTemperatureCelsius: flux.finishMaxSurfaceTemperatureCelsius,
      ...(flux.presetMaxSurfaceTemperatureCelsius != null
        ? { presetMaxSurfaceTemperatureCelsius: flux.presetMaxSurfaceTemperatureCelsius }
        : {}),
      bottomBoundary: flux.bottomBoundary,
      neighborTempC: flux.neighborTempC,
      heatFluxUpLimitedBySurface: flux.heatFluxUpLimitedBySurface,
      warnings: roomWarnings,
    });
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
    mixingRequired = isMixingNodeRequiredForProject(
      boilerSupplyC,
      roomReports,
    );
  }

  const objectType = building?.objectMeta?.objectType;
  const distributionPreset = mixingRequired
    ? resolveUfhDistributionPreset(heatingSystem.underfloorDistributionPreset, {
        objectType,
        roomsWithUfhCount: roomReports.length,
      })
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
    modePreset && ufhModePresetOverridesFinishCircuit(modePreset.presetId)
      ? 'ufh_mode_preset'
      : modePreset?.presetId === UFH_PRESET_MIXED_RADIATORS
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

  /** @type {import('../types/shared-types').UfhMixingNodeSpec | null} */
  let mixingNode = null;
  if (mixingRequired && distributionPreset) {
    mixingNode = computeUfhMixingNodeSpec({
      powerKw: totalHeatFluxUpWatts / 1000,
      deltaTK: 10,
      distributionPreset,
    });
    mixingNode.boilerSupplyC = boilerSupplyC;
    mixingNode.floorCircuitSupplyC = primaryRoom?.circuitSupplyC;
  }

  const allRoomWarnings = roomReports.flatMap((r) => r.warnings);

  return {
    enabled: true,
    circuitSupplyC: primaryRoom?.circuitSupplyC ?? 45,
    circuitReturnC: primaryRoom?.circuitReturnC ?? 35,
    circuitMeanC: primaryRoom?.circuitMeanC ?? 40,
    circuitSource,
    isMixingNodeRequired: mixingRequired,
    distributionPreset,
    mixingNode,
    underfloorHydraulics,
    rooms: roomReports,
    totalHeatFluxUpWatts,
    totalHeatFluxDownWatts,
    warnings: [...globalWarnings, ...allRoomWarnings],
  };
}
