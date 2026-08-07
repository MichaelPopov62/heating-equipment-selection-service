/**
 * Назначение: React Query для карточек режимов ТП.
 */

import { useQuery } from '@tanstack/react-query';

import { FALLBACK_UFH_MODE_PRESETS } from '../../data/fallbackUfhModePresets';
import { fetchUfhModePresets } from '../../services/ufhModePresets';
import type { UfhModePresetCard } from '../../types/ufhModePreset';
import { mergeUfhModePresetsWithFallback } from '../../utils/ufhPresetCardsForUi';
import { REFERENCE_STALE_MS } from '../queryClient';
import { queryKeys } from '../queryKeys';

export type UseUfhModePresetsQueryOptions = {
  /** false — не запрашивать API (Start Screen на главной). */
  enabled?: boolean;
};

export type UseUfhModePresetsQueryResult = {
  ufhModePresets: UfhModePresetCard[];
  ufhModePresetsLoading: boolean;
  ufhModePresetsError: string | null;
};

/**
 * @param options
 * @returns {UseUfhModePresetsQueryResult}
 */
export function useUfhModePresetsQuery(
  options: UseUfhModePresetsQueryOptions = {},
): UseUfhModePresetsQueryResult {
  const enabled = options.enabled ?? true;
  const query = useQuery({
    queryKey: queryKeys.ufhModePresets,
    queryFn: async () => {
      try {
        const data = await fetchUfhModePresets();
        const merged = mergeUfhModePresetsWithFallback(data.presets);
        const apiHasMixed = data.presets.some((p) => p.presetId === 'ufh_mixed_radiators');
        const warning = !apiHasMixed
          ? 'Картку «Тепла підлога + радіатори» підставлено з локального довідника — виконайте npm run seed у backend для синхронізації Mongo.'
          : null;
        return { presets: merged, warning };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Помилка завантаження режимів ТП';
        return { presets: [...FALLBACK_UFH_MODE_PRESETS], warning: message };
      }
    },
    staleTime: REFERENCE_STALE_MS,
    enabled,
  });

  return {
    ufhModePresets: query.data?.presets ?? [],
    ufhModePresetsLoading: enabled && query.isLoading,
    ufhModePresetsError: query.data?.warning ?? null,
  };
}
