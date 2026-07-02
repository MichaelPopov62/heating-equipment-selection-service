/**
 * Назначение: Загрузка карточек режимов ТП с API.
 */

import type { UfhModePresetsResponse } from '../types/ufhModePreset';
/**
 * GET /api/v1/presets/underfloor-heating/modes — только presetId и ui.
 */
export async function fetchUfhModePresets(): Promise<UfhModePresetsResponse> {
  const res = await fetch('/api/v1/presets/underfloor-heating/modes', {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} при загрузке режимов ТП`);
  }
  const json = (await res.json()) as UfhModePresetsResponse;
  if (!json.ok || !Array.isArray(json.presets)) {
    throw new Error('Некорректный ответ API режимов ТП');
  }
  return json;
}
