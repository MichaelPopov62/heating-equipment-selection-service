/**
 * Назначение: Хук загрузки баз ТП и финишных покрытий.
 */

import { useEffect, useState } from 'react';
import { FALLBACK_FLOORING_FINISH_MATERIALS } from '../data/fallbackFlooringFinishes';
import { FALLBACK_UNDERFLOOR_HEATING_BASES } from '../data/fallbackUnderfloorHeatingPresets';
import { fetchUnderfloorHeatingPresets } from '../services/underfloorHeatingPresets';
import type {
  FlooringFinishMaterial,
  UnderfloorHeatingBasePreset,
} from '../types/underfloorHeating';

export function useUnderfloorHeatingPresetsLoader() {
  const [underfloorHeatingBases, setUnderfloorHeatingBases] = useState<
    UnderfloorHeatingBasePreset[]
  >([]);
  const [flooringFinishes, setFlooringFinishes] = useState<FlooringFinishMaterial[]>([]);
  const [underfloorPresetsLoading, setUnderfloorPresetsLoading] = useState(true);
  const [underfloorPresetsError, setUnderfloorPresetsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUnderfloorHeatingPresets()
      .then((bundle) => {
        if (cancelled) return;
        setUnderfloorHeatingBases(bundle.bases);
        setFlooringFinishes(bundle.finishes);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'Ошибка загрузки пресетов ТП';
        setUnderfloorPresetsError(message);
        setUnderfloorHeatingBases([...FALLBACK_UNDERFLOOR_HEATING_BASES]);
        setFlooringFinishes([...FALLBACK_FLOORING_FINISH_MATERIALS]);
      })
      .finally(() => {
        if (cancelled) return;
        setUnderfloorPresetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    underfloorHeatingBases,
    flooringFinishes,
    underfloorPresetsLoading,
    underfloorPresetsError,
  };
}
