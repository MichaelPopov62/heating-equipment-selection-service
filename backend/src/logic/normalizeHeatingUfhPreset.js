/**
 * Назначение: нормализация heatingSystem.ufhPresetId и heatingEmittersMode.
 * Описание: Lookup пресета из переданного bundle; derive supply/return для режима «только ТП»; warnings без мутации графика радиаторов.
 */
import { UFH_PRESET_ONLY, ufhModePresetIsMixedRadiators } from '../../../shared/ufhModePresetIds.js';
import { thermalRegimeRecommendationHint } from '../../../shared/heatingThermalRegimeRecommendations.js';
import { isHeatingThermalRegimePresetId } from './heatingThermalRegimes.js';

/**
 * @param {import('../types/shared-types').CalcRequestBody} body
 * @param {import('../ufh/types').UnderfloorHeatingPresetsBundle} ufhPresets
 */
export function normalizeHeatingUfhPreset(body, ufhPresets) {
  const hs = body.heatingSystem;
  if (!hs || typeof hs !== 'object') return;

  const presetId = typeof hs.ufhPresetId === 'string' ? hs.ufhPresetId.trim() : '';
  if (!presetId) return;

  if (!ufhPresets?.byPresetId) {
    throw new Error('Архитектурная ошибка: ufhPresets обязательны для нормализации ТП.');
  }

  const preset = ufhPresets.byPresetId[presetId];
  if (!preset) {
    const err = new Error(`Неизвестный ufhPresetId "${presetId}".`);
    err.statusCode = 400;
    err.code = 'UFH_PRESET_INVALID';
    throw err;
  }

  hs.waterUnderfloorHeating = true;

  if (!hs.heatingEmittersMode) {
    hs.heatingEmittersMode =
      presetId === UFH_PRESET_ONLY ? 'ufh_only' : 'mixed';
  }

  if (ufhModePresetIsMixedRadiators(presetId) && hs.heatingEmittersMode !== 'ufh_only') {
    hs.heatingEmittersMode = 'mixed';
  }

  if (presetId === UFH_PRESET_ONLY) {
    const tech = preset.technical;
    hs.supplyC = tech.supplyC;
    hs.returnC = tech.returnC;
    if (!isHeatingThermalRegimePresetId(hs.thermalRegimePreset)) {
      hs.thermalRegimePreset = 'condensing_dt30_55_45';
    }
  }

  /** @type {string[]} */
  const normWarnings = [];
  const scheme = hs.hotWaterBoilerPowerMatchingScheme;
  const objectType = body.building?.objectMeta?.objectType;
  const thermalHint = thermalRegimeRecommendationHint(
    scheme,
    objectType,
    hs.thermalRegimePreset,
  );
  if (thermalHint && hs.heatingEmittersMode !== 'ufh_only') {
    normWarnings.push(thermalHint);
  }

  if (preset.technical.requiresCondensingBoiler) {
    normWarnings.push(
      `Режим «${preset.ui.title}» рассчитан на конденсационный котёл (низкотемпературный контур ${preset.technical.supplyC}/${preset.technical.returnC} °C).`,
    );
  }

  if (normWarnings.length) {
    const existing = Array.isArray(hs._normalizationWarnings)
      ? hs._normalizationWarnings
      : [];
    hs._normalizationWarnings = [...existing, ...normWarnings];
  }
}

/**
 * Подсказка при явном thermalRegimePreset, расходящемся с рекомендацией схемы.
 *
 * @param {import('../types/shared-types').CalcRequestBody} body
 */
export function appendThermalRegimeSchemeWarnings(body) {
  const hs = body.heatingSystem;
  if (!hs || typeof hs !== 'object' || hs.ufhPresetId) return;
  if (hs.heatingEmittersMode === 'ufh_only') return;

  const hint = thermalRegimeRecommendationHint(
    hs.hotWaterBoilerPowerMatchingScheme,
    body.building?.objectMeta?.objectType,
    hs.thermalRegimePreset,
  );
  if (!hint) return;

  const existing = Array.isArray(hs._normalizationWarnings)
    ? hs._normalizationWarnings
    : [];
  if (existing.includes(hint)) return;
  hs._normalizationWarnings = [...existing, hint];
}
