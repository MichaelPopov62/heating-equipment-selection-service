/**
 * Назначение: температурные графики системы отопления.
 * Описание: Нормализует heatingSystem по пресетам supply/return/inside и базе ΔT радиаторов; подстраивает график под конденсационный котёл. Реэкспортирует константы из shared/heatingThermalRegimePresets.js. Используется в validate.js, calcInputSchemaLoader.js и matching.
 */

import {
  HEATING_THERMAL_REGIME_PRESETS,
  HEATING_THERMAL_REGIME_PRESET_ENUM,
  defaultThermalRegimePresetForObjectType,
  defaultThermalRegimePresetForMatchingScheme,
  isLowTemperatureThermalRegimePreset,
} from '../../../shared/heatingThermalRegimePresets.js';
import { isCondensingBoiler } from '../utils/boilerMatchingByType.js';

export {
  HEATING_THERMAL_REGIME_PRESETS,
  HEATING_THERMAL_REGIME_PRESET_ENUM,
  defaultThermalRegimePresetForObjectType,
  defaultThermalRegimePresetForMatchingScheme,
  isLowTemperatureThermalRegimePreset,
};

/**
 * Проверка идентификатора пресета.
 * @param {string | undefined | null} id
 * @returns {boolean}
 */
export function isHeatingThermalRegimePresetId(id) {
  return (
    typeof id === 'string'
    && Object.prototype.hasOwnProperty.call(HEATING_THERMAL_REGIME_PRESETS, id)
  );
}

/**
 * Нормализация heatingSystem: пресет задаёт подачу/обратку и (если не указано) базу ΔT каталога радиатора;
 * t внутри для расчёта излучателей подставляется из building.temps при отсутствии heatingSystem.insideC.
 * Без пресета: квартира — 55/45 (конденсация); дом — 75/65 (прежнее поведение).
 *
 * @param {import('../types/shared-types').CalcRequestBody} body
 */
export function normalizeHeatingSystemThermalRegime(body) {
  const hs = body.heatingSystem;
  if (!hs || typeof hs !== 'object') return;

  const buildingInside = body.building?.temps?.insideC;
  if (
    hs.insideC == null
    && typeof buildingInside === 'number'
    && Number.isFinite(buildingInside)
  ) {
    hs.insideC = buildingInside;
  }

  if (!isHeatingThermalRegimePresetId(hs.thermalRegimePreset)) {
    const objectType = body.building?.objectMeta?.objectType;
    if (hs.heatingEmittersMode !== 'ufh_only' && !hs.ufhPresetId) {
      hs.thermalRegimePreset = defaultThermalRegimePresetForMatchingScheme(
        hs.hotWaterBoilerPowerMatchingScheme,
        objectType,
      );
    }
  }

  if (isHeatingThermalRegimePresetId(hs.thermalRegimePreset)) {
    const p = HEATING_THERMAL_REGIME_PRESETS[hs.thermalRegimePreset];
    hs.supplyC = p.supplyC;
    hs.returnC = p.returnC;
    if (hs.radiatorReferenceDeltaT == null) {
      hs.radiatorReferenceDeltaT = p.defaultRadiatorReferenceDeltaT;
    }
    return;
  }

  if (hs.supplyC == null) hs.supplyC = 75;
  if (hs.returnC == null) hs.returnC = 65;
}

/** @returns {string} Человекочитаемая метка текущего графика для сообщений. */
function formatHeatingGraphLabel(hs) {
  if (isHeatingThermalRegimePresetId(hs.thermalRegimePreset)) {
    return hs.thermalRegimePreset;
  }
  const s = hs.supplyC;
  const r = hs.returnC;
  if (typeof s === 'number' && typeof r === 'number') {
    return `${s}/${r} °C`;
  }
  return 'высокотемпературный';
}

/**
 * Высокотемпературный график (не подходит для устойчивой конденсации).
 * @param {import('../types/shared-types').HeatingSystemInput | undefined} hs
 * @returns {boolean}
 */
export function isHighTemperatureHeatingGraph(hs) {
  if (!hs || typeof hs !== 'object') return false;
  if (hs.thermalRegimePreset === 'condensing_dt30_55_45') return false;
  if (
    hs.thermalRegimePreset === 'traditional_dt50_75_65' ||
    hs.thermalRegimePreset === 'traditional_high_dt70_95_85'
  ) {
    return true;
  }
  const supply = Number(hs.supplyC);
  const ret = Number(hs.returnC);
  if (Number.isFinite(ret) && ret >= 55) return true;
  if (Number.isFinite(supply) && supply >= 65) return true;
  return false;
}

/**
 * Подставляет пресет в heatingSystem (подача, обратка, база ΔT каталога).
 * @param {import('../types/shared-types').HeatingSystemInput} hs
 * @param {import('../types/shared-types').HeatingThermalRegimePreset} presetId
 * @returns {boolean}
 */
export function applyThermalRegimePresetToHeatingSystem(hs, presetId) {
  if (!hs || typeof hs !== 'object') return false;
  if (!isHeatingThermalRegimePresetId(presetId)) return false;
  const p = HEATING_THERMAL_REGIME_PRESETS[presetId];
  hs.thermalRegimePreset = presetId;
  hs.supplyC = p.supplyC;
  hs.returnC = p.returnC;
  hs.radiatorReferenceDeltaT = p.defaultRadiatorReferenceDeltaT;
  return true;
}

/**
 * Если подобран конденсационный котёл, а график высокотемпературный — предупреждение без подмены input.
 *
 * @param {import('../types/shared-types').HeatingSystemInput | undefined} heatingSystem
 * @param {import('../catalog/types').BoilerCatalogItemNormalized | null | undefined} selectedBoiler
 * @returns {string | null} Текст предупреждения или null
 */
export function alignHeatingGraphForCondensingBoiler(heatingSystem, selectedBoiler) {
  if (!heatingSystem || typeof heatingSystem !== 'object' || !selectedBoiler) {
    return null;
  }
  if (!isCondensingBoiler(selectedBoiler)) return null;
  if (!isHighTemperatureHeatingGraph(heatingSystem)) return null;
  if (heatingSystem.heatingEmittersMode === 'ufh_only') return null;

  const previousLabel = formatHeatingGraphLabel(heatingSystem);
  const model =
    typeof selectedBoiler.model === 'string' ? selectedBoiler.model : 'котёл';
  return (
    `Подобран конденсационный котёл ${model}, а радиаторный график высокотемпературный (${previousLabel}). ` +
    'При обратке выше ~55 °C конденсация и заявленный КПД могут не достигаться. Расчёт радиаторов выполнен по выбранному графику.'
  );
}
