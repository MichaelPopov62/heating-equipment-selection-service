/**
 * Назначение: расчёт U наружной стены по многослойной конструкции.
 * Описание: Вычисляет коэффициент теплопередачи R = Rsi+Rse + dст/λст + dут/λут для objectMeta.externalWalls с учётом фасадной системы (none/sftk/ventilated). Экспортирует resolveExternalWallUValue и константы пресетов утеплителя. Используется в heatlossByRooms.js и externalWallsValidate.js.
 */

import { getEnvelopePresetById } from './envelopePresets.js';

/** Системы утепления фасада (objectMeta.externalWalls.facadeSystem). */
export const FACADE_SYSTEMS = Object.freeze(['none', 'sftk', 'ventilated']);

/** ППС 16Ф (ПСБ-С 25Ф) — единственный ППС для СФТК по СП 50.13330. */
export const INSUL_SFTK_PPS16F_ID = 'insul_sftk_pps16f';

const MINERAL_WOOL_PREFIX = 'insul_minwool_';

/** Поверхностное сопротивление Rsi+Rse для вертикальных стен, м²·К/Вт. */
export const WALL_SURFACE_R = 0.158;

/** @type {Readonly<{ min: number; max: number }>} */
export const INSULATION_THICKNESS_BOUNDS = Object.freeze({ min: 30, max: 300 });

/**
 * @param {string | null | undefined} presetId
 * @returns {boolean}
 */
export function isMineralWoolInsulationPresetId(presetId) {
  return String(presetId ?? '').startsWith(MINERAL_WOOL_PREFIX);
}

/**
 * @param {string | null | undefined} presetId
 * @returns {boolean}
 */
export function isSftkInsulationPresetId(presetId) {
  return String(presetId ?? '') === INSUL_SFTK_PPS16F_ID;
}

/**
 * λ утеплителя из пресета (только kind=insulation, поле uModel.lambdaWmK).
 *
 * @param {string} insulationPresetId
 * @returns {number | null}
 */
function insulationLambdaFromPresetId(insulationPresetId) {
  const preset = getEnvelopePresetById(insulationPresetId);
  if (!preset || preset.kind !== 'insulation') return null;
  const lambda = preset.uModel?.lambdaWmK;
  return typeof lambda === 'number' && lambda > 0 ? lambda : null;
}

/**
 * U многослойной наружной стены: R = Rпов + dст/λст + dут/λут.
 *
 * @param {object} args
 * @param {number} args.wallLambdaWmK
 * @param {number} args.wallThicknessMm
 * @param {number} [args.insulationLambdaWmK]
 * @param {number} [args.insulationThicknessMm]
 * @param {number} [args.surfaceR]
 * @returns {number}
 */
function computeWallUFromLayers({
  wallLambdaWmK,
  wallThicknessMm,
  insulationLambdaWmK = 0,
  insulationThicknessMm = 0,
  surfaceR = WALL_SURFACE_R,
}) {
  if (!(wallLambdaWmK > 0) || !(wallThicknessMm > 0)) {
    throw new Error('computeWallUFromLayers: некорректные параметры несущего слоя');
  }
  const rWall = wallThicknessMm / 1000 / wallLambdaWmK;
  let rIns = 0;
  if (insulationLambdaWmK > 0 && insulationThicknessMm > 0) {
    rIns = insulationThicknessMm / 1000 / insulationLambdaWmK;
  }
  const rTotal = surfaceR + rWall + rIns;
  if (!(rTotal > 0)) {
    throw new Error('computeWallUFromLayers: суммарное R должно быть > 0');
  }
  return 1 / rTotal;
}

/**
 * U наружной стены объекта по objectMeta.externalWalls и пресету стены.
 *
 * @param {import('../types/shared-types.js').BuildingObjectMetaExternalWalls} externalWalls
 * @param {string | null | undefined} [wallPresetIdOverride] presetId элемента (если отличается)
 * @returns {number}
 */
export function resolveExternalWallUValue(externalWalls, wallPresetIdOverride = undefined) {
  const wallPresetId = wallPresetIdOverride ?? externalWalls?.presetId;
  const wallPreset = getEnvelopePresetById(wallPresetId);
  if (!wallPreset || wallPreset.kind !== 'wall') {
    throw new Error(`resolveExternalWallUValue: неизвестный пресет стены "${wallPresetId}"`);
  }

  const facadeSystem = externalWalls?.facadeSystem ?? 'none';
  const wallThicknessMm = externalWalls?.thicknessMm;

  if (facadeSystem === 'none') {
    if (wallPreset.uModel && wallThicknessMm != null) {
      return computeWallUFromLayers({
        wallLambdaWmK: wallPreset.uModel.lambdaWmK,
        wallThicknessMm,
        surfaceR: wallPreset.uModel.surfaceR ?? WALL_SURFACE_R,
      });
    }
    if (wallPreset.uValue != null) return wallPreset.uValue;
    throw new Error(
      `resolveExternalWallUValue: для "${wallPresetId}" задайте thicknessMm (uModel) или uValue`,
    );
  }

  if (wallThicknessMm == null || !(wallThicknessMm > 0)) {
    throw new Error('resolveExternalWallUValue: задайте thicknessMm несущей стены');
  }
  if (!wallPreset.uModel?.lambdaWmK) {
    throw new Error(
      `resolveExternalWallUValue: пресет "${wallPresetId}" не поддерживает расчёт слоёв (нет uModel)`,
    );
  }

  const insulId = externalWalls?.insulationPresetId;
  const insulThicknessMm = externalWalls?.insulationThicknessMm;
  if (!insulId || insulThicknessMm == null || !(insulThicknessMm > 0)) {
    throw new Error('resolveExternalWallUValue: задайте insulationPresetId и insulationThicknessMm');
  }

  const insulLambda = insulationLambdaFromPresetId(insulId);
  if (insulLambda == null) {
    throw new Error(`resolveExternalWallUValue: неизвестный пресет утеплителя "${insulId}"`);
  }

  return computeWallUFromLayers({
    wallLambdaWmK: wallPreset.uModel.lambdaWmK,
    wallThicknessMm,
    insulationLambdaWmK: insulLambda,
    insulationThicknessMm: insulThicknessMm,
    surfaceR: wallPreset.uModel.surfaceR ?? WALL_SURFACE_R,
  });
}
