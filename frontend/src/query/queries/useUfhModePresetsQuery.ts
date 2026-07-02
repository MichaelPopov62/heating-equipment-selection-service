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

export type UseUfhModePresetsQueryResult = {
  ufhModePresets: UfhModePresetCard[];
  ufhModePresetsLoading: boolean;
  ufhModePresetsError: string | null;
};

/**
 * @returns {UseUfhModePresetsQueryResult}
 */
export function useUfhModePresetsQuery(): UseUfhModePresetsQueryResult {
  const query = useQuery({
    queryKey: queryKeys.ufhModePresets,
    queryFn: async () => {
      try {
        const data = await fetchUfhModePresets();
        const merged = mergeUfhModePresetsWithFallback(data.presets);
        const apiHasMixed = data.presets.some((p) => p.presetId === 'ufh_mixed_radiators');
        const warning = !apiHasMixed
          ? 'Карточка «Тёплый пол + радиаторы» подставлена из локального справочника — выполните npm run seed в backend для синхронизации Mongo.'
          : null;
        return { presets: merged, warning };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Ошибка загрузки режимов ТП';
        return { presets: [...FALLBACK_UFH_MODE_PRESETS], warning: message };
      }
    },
    staleTime: REFERENCE_STALE_MS,
  });

  return {
    ufhModePresets: query.data?.presets ?? [],
    ufhModePresetsLoading: query.isPending,
    ufhModePresetsError: query.data?.warning ?? null,
  };
}
