/**
 * Назначение: валидация параметров наружных стен объекта.
 * Описание: Проверяет и нормализует objectMeta.externalWalls: фасадная система, пресеты утеплителя (СФТК — ППС 16Ф, вентфасад — минвата), толщины. Мигрирует legacy wall_pps_* в новую схему. Экспортирует assertExternalWalls(); вызывается из validate.js после AJV.
 */

import { getEnvelopePresetById } from './envelopePresets.js';
import {
  FACADE_SYSTEMS,
  INSUL_SFTK_PPS16F_ID,
  INSULATION_THICKNESS_BOUNDS,
  LEGACY_COMBINED_WALL_PRESET_IDS,
  isMineralWoolInsulationPresetId,
  isSftkInsulationPresetId,
} from './wallAssembly.js';

/**
 * Миграция wall_pps_* → несущий слой + СФТК (ППС 16Ф).
 *
 * @param {Record<string, unknown>} ew
 * @returns {boolean} true, если выполнена миграция
 */
function normalizeLegacyCombinedWallPresets(ew) {
  const presetId = String(ew.presetId ?? '').trim();
  if (!LEGACY_COMBINED_WALL_PRESET_IDS.has(presetId)) return false;

  const insulationThicknessMm = presetId === 'wall_pps_50' ? 50 : 100;
  ew.presetId = 'wall_gas_concrete_d500';
  if (ew.thicknessMm == null) ew.thicknessMm = 375;
  ew.facadeSystem = 'sftk';
  ew.insulationPresetId = INSUL_SFTK_PPS16F_ID;
  ew.insulationThicknessMm = ew.insulationThicknessMm ?? insulationThicknessMm;
  return true;
}

/**
 * Нормализация и cross-validation externalWalls (СП 50.13330: СФТК — только ППС 16Ф; открытый фасад — минвата).
 *
 * @param {import('../types/shared-types').BuildingInput | undefined} building
 */
export function assertExternalWalls(building) {
  if (!building?.objectMeta?.externalWalls) return;

  const ew = /** @type {Record<string, unknown>} */ (
    /** @type {import('../types/shared-types').BuildingObjectMetaExternalWalls} */ (
      building.objectMeta.externalWalls
    )
  );

  normalizeLegacyCombinedWallPresets(ew);

  const presetId = String(ew.presetId ?? '').trim();
  if (!presetId) {
    throw fieldError('EXTERNAL_WALLS_PRESET_REQUIRED', 'Укажите building.objectMeta.externalWalls.presetId');
  }

  if (LEGACY_COMBINED_WALL_PRESET_IDS.has(presetId)) {
    throw fieldError(
      'EXTERNAL_WALLS_LEGACY_PRESET',
      `Пресет "${presetId}" устарел: укажите несущую стену без утеплителя и систему фасада (facadeSystem: sftk | ventilated | none).`,
    );
  }

  const wallPreset = getEnvelopePresetById(presetId);
  if (!wallPreset || wallPreset.kind !== 'wall') {
    throw fieldError(
      'EXTERNAL_WALLS_INVALID_PRESET',
      `externalWalls.presetId="${presetId}" должен ссылаться на пресет kind=wall (несущий слой без утеплителя). Утеплитель задаётся отдельно через facadeSystem + insulationPresetId.`,
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
      `facadeSystem должен быть одним из: ${FACADE_SYSTEMS.join(', ')}.`,
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
      `При facadeSystem="${facadeSystem}" укажите insulationPresetId.`,
    );
  }

  if (insulThickness == null || !Number.isFinite(Number(insulThickness)) || Number(insulThickness) <= 0) {
    throw fieldError(
      'EXTERNAL_WALLS_INSULATION_THICKNESS',
      `При facadeSystem="${facadeSystem}" укажите insulationThicknessMm (мм).`,
    );
  }

  const t = Number(insulThickness);
  if (t < INSULATION_THICKNESS_BOUNDS.min || t > INSULATION_THICKNESS_BOUNDS.max) {
    throw fieldError(
      'EXTERNAL_WALLS_INSULATION_THICKNESS',
      `insulationThicknessMm должна быть в диапазоне ${INSULATION_THICKNESS_BOUNDS.min}…${INSULATION_THICKNESS_BOUNDS.max} мм.`,
    );
  }
  ew.insulationThicknessMm = t;

  const insulPreset = getEnvelopePresetById(insulId);
  if (!insulPreset || insulPreset.kind !== 'insulation') {
    throw fieldError(
      'EXTERNAL_WALLS_INSULATION_PRESET',
      `insulationPresetId="${insulId}" должен ссылаться на пресет kind=insulation.`,
    );
  }

  if (facadeSystem === 'sftk') {
    if (!isSftkInsulationPresetId(insulId)) {
      throw fieldError(
        'EXTERNAL_WALLS_SFTK_INSULATION',
        `Для СФТК («мокрый фасад») допустим только ППС 16Ф (ПСБ-С 25Ф): insulationPresetId="${INSUL_SFTK_PPS16F_ID}". ППС-25/35 в открытом виде не применяются.`,
      );
    }
  }

  if (facadeSystem === 'ventilated') {
    if (!isMineralWoolInsulationPresetId(insulId)) {
      throw fieldError(
        'EXTERNAL_WALLS_VENTILATED_INSULATION',
        'Для открытого/вентилируемого фасада допустима только минеральная вата (insul_minwool_*).',
      );
    }
  }

  if (wallPreset.uModel && (ew.thicknessMm == null || !(Number(ew.thicknessMm) > 0))) {
    throw fieldError(
      'EXTERNAL_WALLS_WALL_THICKNESS',
      'При утеплённом фасаде задайте thicknessMm несущей стены для расчёта U по слоям.',
    );
  }

  const structuralWallPresetId = String(ew.presetId ?? '').trim();
  for (const el of building.envelopeElements ?? []) {
    if (el?.kind !== 'wall') continue;
    const elPreset = el.presetId ? String(el.presetId) : '';
    if (LEGACY_COMBINED_WALL_PRESET_IDS.has(elPreset)) {
      el.presetId = structuralWallPresetId;
      continue;
    }
    if (elPreset.startsWith('insul_')) {
      throw fieldError(
        'ENVELOPE_WALL_INSULATION_PRESET',
        `Элемент стены roomId="${el.roomId}": presetId="${elPreset}" — это утеплитель (kind=insulation), укажите пресет несущей стены.`,
      );
    }
  }
}

/**
 * @param {string} code
 * @param {string} message
 * @returns {Error & { statusCode: number, code: string }}
 */
function fieldError(code, message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}
