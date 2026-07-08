/**
 * Назначение: порядок и видимость карточек режимов ТП в анкете.
 */

import type { UfhModePresetCard, UfhModePresetId } from '../types/ufhModePreset';
import { FALLBACK_UFH_MODE_PRESETS } from '../data/fallbackUfhModePresets';
import { warnCompatMigration } from './compatTelemetry';

/** Основные режимы в UI (явная карточка «ТП + радиаторы»). */
export const PRIMARY_UFH_MODE_PRESET_IDS: readonly UfhModePresetId[] = [
  'ufh_mixed_radiators',
  'ufh_only',
];

/** Legacy-пресеты — показываем только если уже выбраны в черновике. */
export const LEGACY_UFH_MODE_PRESET_IDS: readonly UfhModePresetId[] = [
  'ufh_direct_tile',
  'ufh_direct_laminate',
];

/**
 * Дополняет ответ API локальным fallback (актуальные подписи, если Mongo/кэш ещё без ufh_mixed_radiators).
 * Приоритет у данных API при совпадении presetId.
 *
 * @param fromApi — presets из GET /modes
 * @param fallback — локальный эталон
 */
export function mergeUfhModePresetsWithFallback(
  fromApi: UfhModePresetCard[],
  fallback: UfhModePresetCard[] = FALLBACK_UFH_MODE_PRESETS,
): UfhModePresetCard[] {
  const byId = new Map(fallback.map((p) => [p.presetId, p]));
  for (const p of fromApi) {
    byId.set(p.presetId, p);
  }
  return [...byId.values()];
}

/**
 * Карточки для отображения: основные + legacy при необходимости.
 *
 * @param presets — полный список с API/fallback
 * @param selectedPresetId — текущий выбор анкеты
 */
export function ufhPresetCardsForUi(
  presets: UfhModePresetCard[],
  selectedPresetId: UfhModePresetId | null,
): UfhModePresetCard[] {
  const byId = new Map(presets.map((p) => [p.presetId, p]));
  /** @type {UfhModePresetCard[]} */
  const visible: UfhModePresetCard[] = [];

  for (const id of PRIMARY_UFH_MODE_PRESET_IDS) {
    const card = byId.get(id);
    if (card) visible.push(card);
  }

  if (
    selectedPresetId != null
    && (LEGACY_UFH_MODE_PRESET_IDS as readonly string[]).includes(selectedPresetId)
  ) {
    const legacy = byId.get(selectedPresetId);
    if (legacy && !visible.some((c) => c.presetId === legacy.presetId)) {
      warnCompatMigration('UfhModePresetUi', `показ legacy-карточки ${selectedPresetId}`);
      visible.push(legacy);
    }
  }

  return visible;
}

/**
 * @param id
 * @returns {id is UfhModePresetId}
 */
export function isUfhModePresetId(id: string | null | undefined): id is UfhModePresetId {
  if (!id) return false;
  return (
    id === 'ufh_only'
    || id === 'ufh_mixed_radiators'
    || id === 'ufh_direct_tile'
    || id === 'ufh_direct_laminate'
  );
}
