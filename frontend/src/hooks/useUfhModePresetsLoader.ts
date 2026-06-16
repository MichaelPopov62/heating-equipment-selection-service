/**
 * Назначение: Хук загрузки карточек режимов ТП (Mongo underfloor_heating_presets).
 */

import { useEffect, useState } from 'react';
import { FALLBACK_UFH_MODE_PRESETS } from '../data/fallbackUfhModePresets';
import { fetchUfhModePresets } from '../services/ufhModePresets';
import { mergeUfhModePresetsWithFallback } from '../utils/ufhPresetCardsForUi';
import type { UfhModePresetCard } from '../types/ufhModePreset';

export function useUfhModePresetsLoader() {
  const [ufhModePresets, setUfhModePresets] = useState<UfhModePresetCard[]>([]);
  const [ufhModePresetsLoading, setUfhModePresetsLoading] = useState(true);
  const [ufhModePresetsError, setUfhModePresetsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUfhModePresets()
      .then((data) => {
        if (cancelled) return;
        const merged = mergeUfhModePresetsWithFallback(data.presets);
        const apiHasMixed = data.presets.some((p) => p.presetId === 'ufh_mixed_radiators');
        if (!apiHasMixed) {
          setUfhModePresetsError(
            'Карточка «Тёплый пол + радиаторы» подставлена из локального справочника — выполните npm run seed в backend для синхронизации Mongo.',
          );
        } else {
          setUfhModePresetsError(null);
        }
        setUfhModePresets(merged);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'Ошибка загрузки режимов ТП';
        setUfhModePresetsError(message);
        setUfhModePresets([...FALLBACK_UFH_MODE_PRESETS]);
      })
      .finally(() => {
        if (cancelled) return;
        setUfhModePresetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ufhModePresets, ufhModePresetsLoading, ufhModePresetsError };
}
