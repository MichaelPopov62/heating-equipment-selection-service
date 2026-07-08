/**
 * Назначение: порядок и видимость карточек режимов ТП в анкете.
 */

import type { UfhModePresetCard, UfhModePresetId } from '../types/ufhModePreset';
import { FALLBACK_UFH_MODE_PRESETS } from '../data/fallbackUfhModePresets';

/** Основные режимы в UI (явная карточка «ТП + радиаторы»). */
export const PRIMARY_UFH_MODE_PRESET_IDS: readonly UfhModePresetId[] = [
  'ufh_mixed_radiators',
  'ufh_only',
];

/**
 * @param id
 * @returns {id is UfhModePresetId}
 */
export function isUfhModePresetId(id: string | null | undefined): id is UfhModePresetId {
  return id === 'ufh_only' || id === 'ufh_mixed_radiators';
}

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
    if (isUfhModePresetId(p.presetId)) {
      byId.set(p.presetId, p);
    }
  }
  return [...byId.values()];
}

/**
 * Карточки для отображения: только актуальные режимы.
 *
 * @param presets — полный список с API/fallback
 */
export function ufhPresetCardsForUi(presets: UfhModePresetCard[]): UfhModePresetCard[] {
  const byId = new Map(presets.map((p) => [p.presetId, p]));
  /** @type {UfhModePresetCard[]} */
  const visible: UfhModePresetCard[] = [];

  for (const id of PRIMARY_UFH_MODE_PRESET_IDS) {
    const card = byId.get(id);
    if (card) visible.push(card);
  }

  return visible;
}
