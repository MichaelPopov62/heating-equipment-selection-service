/**
 * Назначение: Загрузка карточек режимов ТП с API.
 */

import type { UfhModePresetsResponse } from '../types/ufhModePreset';
import { fetchOnce } from '../utils/fetchOnce';

const UFH_MODE_PRESETS_ONCE_KEY = 'GET /api/v1/presets/underfloor-heating/modes?v=2';

/**
 * GET /api/v1/presets/underfloor-heating/modes — только presetId и ui.
 */
export function fetchUfhModePresets(): Promise<UfhModePresetsResponse> {
  return fetchOnce(UFH_MODE_PRESETS_ONCE_KEY, async () => {
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
  });
}
