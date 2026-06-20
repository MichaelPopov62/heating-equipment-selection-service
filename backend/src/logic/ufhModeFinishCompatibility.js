/**
 * Назначение: согласованность режима ТП (Mongo) и финиша комнаты (data/).
 * Описание: Для ufh_direct_* проверяет finishMaterialId по finishMaterialIds из ufhCircuitPresets;
 * утилита сверки technical mode preset с контурами 45/35 и 40/30.
 */

import { resolveUnderfloorHeatingComposition } from '../data/warmFloorAssemblyPresets.js';
import { UFH_CIRCUIT_PRESETS } from '../../../shared/ufhCircuitPresets.js';
import {
  UFH_PRESET_DIRECT_LAMINATE,
  UFH_PRESET_DIRECT_TILE,
  ufhModePresetOverridesFinishCircuit,
} from '../../../shared/ufhModePresetIds.js';

/** @type {Readonly<Record<string, string>>} */
export const UFH_DIRECT_MODE_CIRCUIT_PRESET_ID = Object.freeze({
  [UFH_PRESET_DIRECT_TILE]: 'ufh_dt10_45_35',
  [UFH_PRESET_DIRECT_LAMINATE]: 'ufh_dt10_40_30',
});

/** @type {Readonly<Record<string, ReadonlySet<string>>>} */
const DIRECT_MODE_ALLOWED_FINISH_IDS = Object.freeze({
  [UFH_PRESET_DIRECT_TILE]: new Set(UFH_CIRCUIT_PRESETS.ufh_dt10_45_35.finishMaterialIds),
  [UFH_PRESET_DIRECT_LAMINATE]: new Set(UFH_CIRCUIT_PRESETS.ufh_dt10_40_30.finishMaterialIds),
});

/**
 * @param {string} presetId
 * @returns {ReadonlySet<string> | null}
 */
export function getAllowedFinishIdsForDirectUfhMode(presetId) {
  return DIRECT_MODE_ALLOWED_FINISH_IDS[presetId] ?? null;
}

/**
 * Cross-validation: ufh_direct_tile / ufh_direct_laminate ↔ finishMaterialId комнат с ТП.
 *
 * @param {import('../types/shared-types').CalcRequestBody} body
 */
export function assertUfhModeFinishCompatibility(body) {
  const hs = body.heatingSystem;
  if (!hs || typeof hs !== 'object') return;

  const presetId = typeof hs.ufhPresetId === 'string' ? hs.ufhPresetId.trim() : '';
  if (!ufhModePresetOverridesFinishCircuit(presetId)) return;

  const allowed = getAllowedFinishIdsForDirectUfhMode(presetId);
  if (!allowed) return;

  const rooms = body.building?.rooms ?? [];
  for (const room of rooms) {
    const composed = resolveUnderfloorHeatingComposition(room.underfloorHeating);
    if (!composed) continue;

    const { finishMaterialId } = composed;
    if (allowed.has(finishMaterialId)) continue;

    const expected = [...allowed].join(', ');
    const err = new Error(
      `Режим «${presetId}» несовместим с финишем «${finishMaterialId}» в комнате «${room.name ?? room.id}». Допустимые finishMaterialId: ${expected}.`,
    );
    err.statusCode = 400;
    err.code = 'UFH_MODE_FINISH_MISMATCH';
    throw err;
  }
}

/**
 * Сверка technical mode preset с shared/ufhCircuitPresets (для verify:ufh-presets).
 *
 * @param {import('../ufh/types').UnderfloorHeatingPresetsBundle} bundle
 * @returns {string[]}
 */
export function collectUfhModeCircuitAlignmentIssues(bundle) {
  /** @type {string[]} */
  const issues = [];

  for (const [modeId, circuitId] of Object.entries(UFH_DIRECT_MODE_CIRCUIT_PRESET_ID)) {
    const modePreset = bundle.byPresetId[modeId];
    const circuit = UFH_CIRCUIT_PRESETS[/** @type {keyof typeof UFH_CIRCUIT_PRESETS} */ (circuitId)];
    if (!modePreset) {
      issues.push(`отсутствует mode preset "${modeId}"`);
      continue;
    }
    if (!circuit) {
      issues.push(`отсутствует circuit preset "${circuitId}"`);
      continue;
    }
    const tech = modePreset.technical;
    if (tech.maxSupplyTemperatureC !== circuit.supplyC) {
      issues.push(
        `${modeId}: maxSupplyTemperatureC=${tech.maxSupplyTemperatureC}, ожидалось ${circuit.supplyC} (${circuitId})`,
      );
    }
    if (tech.supplyC !== circuit.supplyC) {
      issues.push(
        `${modeId}: supplyC=${tech.supplyC}, ожидалось ${circuit.supplyC} (${circuitId})`,
      );
    }
    if (tech.returnC !== circuit.returnC) {
      issues.push(
        `${modeId}: returnC=${tech.returnC}, ожидалось ${circuit.returnC} (${circuitId})`,
      );
    }
  }

  return issues;
}
