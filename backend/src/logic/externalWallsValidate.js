/**
 * Назначение: валидация параметров наружных стен объекта.
 * Описание: Проверяет и нормализует objectMeta.externalWalls: фасадная система, пресеты утеплителя (СФТК — ППС 16Ф, вентфасад — минвата), толщины. Экспортирует assertExternalWalls(); вызывается из validate.js после AJV.
 */

import { getEnvelopePresetById } from './envelopePresets.js';
import {
  FACADE_SYSTEMS,
  INSUL_SFTK_PPS16F_ID,
  INSULATION_THICKNESS_BOUNDS,
  isMineralWoolInsulationPresetId,
  isSftkInsulationPresetId,
} from './wallAssembly.js';

/**
 * Нормализация и cross-validation externalWalls (СП 50.13330: СФТК — только ППС 16Ф; открытый фасад — минвата).
 *
 * @param {import('../types/shared-types.js').BuildingInput | undefined} building
 */
export function assertExternalWalls(building) {
  if (!building?.objectMeta?.externalWalls) return;

  const ew = /** @type {Record<string, unknown>} */ (
    /** @type {unknown} */ (building.objectMeta.externalWalls)
  );

  const presetId = String(ew.presetId ?? '').trim();
  if (!presetId) {
    throw fieldError('EXTERNAL_WALLS_PRESET_REQUIRED', 'Вкажіть building.objectMeta.externalWalls.presetId');
  }

  const wallPreset = getEnvelopePresetById(presetId);
  if (!wallPreset || wallPreset.kind !== 'wall') {
    throw fieldError(
      'EXTERNAL_WALLS_INVALID_PRESET',
      `externalWalls.presetId="${presetId}" має посилатися на пресет kind=wall (несучий шар без утеплювача). Утеплювач задається окремо через facadeSystem + insulationPresetId.`,
    );
  }

  let facadeSystem = ew.facadeSystem;
  if (facadeSystem == null || facadeSystem === '') {
    facadeSystem = 'none';
    ew.facadeSystem = 'none';
  }

  if (!FACADE_SYSTEMS.includes(/** @type {string} */ (facadeSystem))) {
    throw fieldError(
      'EXTERNAL_WALLS_FACADE_SYSTEM',
      `facadeSystem має бути одним із: ${FACADE_SYSTEMS.join(', ')}.`,
    );
  }

  if (facadeSystem === 'none') {
    delete ew.insulationPresetId;
    delete ew.insulationThicknessMm;
    return;
  }

  const insulId = String(ew.insulationPresetId ?? '').trim();
  const insulThickness = ew.insulationThicknessMm;

  if (!insulId) {
    throw fieldError(
      'EXTERNAL_WALLS_INSULATION_REQUIRED',
      `При facadeSystem="${facadeSystem}" вкажіть insulationPresetId.`,
    );
  }

  if (insulThickness == null || !Number.isFinite(Number(insulThickness)) || Number(insulThickness) <= 0) {
    throw fieldError(
      'EXTERNAL_WALLS_INSULATION_THICKNESS',
      `При facadeSystem="${facadeSystem}" вкажіть insulationThicknessMm (мм).`,
    );
  }

  const t = Number(insulThickness);
  if (t < INSULATION_THICKNESS_BOUNDS.min || t > INSULATION_THICKNESS_BOUNDS.max) {
    throw fieldError(
      'EXTERNAL_WALLS_INSULATION_THICKNESS',
      `insulationThicknessMm має бути в діапазоні ${INSULATION_THICKNESS_BOUNDS.min}…${INSULATION_THICKNESS_BOUNDS.max} мм.`,
    );
  }
  ew.insulationThicknessMm = t;

  const insulPreset = getEnvelopePresetById(insulId);
  if (!insulPreset || insulPreset.kind !== 'insulation') {
    throw fieldError(
      'EXTERNAL_WALLS_INSULATION_PRESET',
      `insulationPresetId="${insulId}" має посилатися на пресет kind=insulation.`,
    );
  }

  if (facadeSystem === 'sftk') {
    if (!isSftkInsulationPresetId(insulId)) {
      throw fieldError(
        'EXTERNAL_WALLS_SFTK_INSULATION',
        `Для СФТК («мокрий фасад») допустимий лише ППС 16Ф (ПСБ-С 25Ф): insulationPresetId="${INSUL_SFTK_PPS16F_ID}". ППС-25/35 у відкритому вигляді не застосовуються.`,
      );
    }
  }

  if (facadeSystem === 'ventilated') {
    if (!isMineralWoolInsulationPresetId(insulId)) {
      throw fieldError(
        'EXTERNAL_WALLS_VENTILATED_INSULATION',
        'Для відкритого/вентильованого фасаду допустима лише мінеральна вата (insul_minwool_*).',
      );
    }
  }

  if (wallPreset.uModel && (ew.thicknessMm == null || !(Number(ew.thicknessMm) > 0))) {
    throw fieldError(
      'EXTERNAL_WALLS_WALL_THICKNESS',
      'При утепленому фасаді задайте thicknessMm несучої стіни для розрахунку U по шарах.',
    );
  }

  for (const el of building.envelopeElements ?? []) {
    if (el?.kind !== 'wall') continue;
    const elPreset = el.presetId ? String(el.presetId) : '';
    if (elPreset.startsWith('insul_')) {
      throw fieldError(
        'ENVELOPE_WALL_INSULATION_PRESET',
        `Елемент стіни roomId="${el.roomId}": presetId="${elPreset}" — це утеплювач (kind=insulation), вкажіть пресет несучої стіни.`,
      );
    }
  }
}

/**
 * @param {string} code
 * @param {string} message
 * @returns {Error & import('../types/shared-types.js').AppErrorLike}
 */
function fieldError(code, message) {
  const err = new Error(message);
  /** @type {Error & import('../types/shared-types.js').AppErrorLike} */
  const appErr = err;
  appErr.statusCode = 400;
  appErr.code = code;
  return appErr;
}
