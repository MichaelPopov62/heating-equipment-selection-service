/**
 * Назначение: React Query для баз ТП и финишных покрытий.
 */

import { useQuery } from '@tanstack/react-query';

import { fetchUnderfloorHeatingPresets } from '../../services/underfloorHeatingPresets';
import type {
  FlooringFinishMaterial,
  UnderfloorHeatingBasePreset,
} from '../../types/underfloorHeating';
import { REFERENCE_STALE_MS } from '../queryClient';
import { queryKeys } from '../queryKeys';

export type UseUnderfloorHeatingPresetsQueryOptions = {
  /** false — не запрашивать API (Start Screen на главной). */
  enabled?: boolean;
};

export type UseUnderfloorHeatingPresetsQueryResult = {
  underfloorHeatingBases: UnderfloorHeatingBasePreset[];
  flooringFinishes: FlooringFinishMaterial[];
  underfloorPresetsLoading: boolean;
  underfloorPresetsError: string | null;
};

/**
 * @param options
 * @returns {UseUnderfloorHeatingPresetsQueryResult}
 */
export function useUnderfloorHeatingPresetsQuery(
  options: UseUnderfloorHeatingPresetsQueryOptions = {},
): UseUnderfloorHeatingPresetsQueryResult {
  const enabled = options.enabled ?? true;
  const query = useQuery({
    queryKey: queryKeys.underfloorHeatingPresets,
    queryFn: fetchUnderfloorHeatingPresets,
    staleTime: REFERENCE_STALE_MS,
    enabled,
  });

  return {
    underfloorHeatingBases: query.data?.bases ?? [],
    flooringFinishes: query.data?.finishes ?? [],
    underfloorPresetsLoading: enabled && query.isLoading,
    underfloorPresetsError: query.error instanceof Error ? query.error.message : null,
  };
}
