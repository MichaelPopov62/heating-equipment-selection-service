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

export type UseUnderfloorHeatingPresetsQueryResult = {
  underfloorHeatingBases: UnderfloorHeatingBasePreset[];
  flooringFinishes: FlooringFinishMaterial[];
  underfloorPresetsLoading: boolean;
  underfloorPresetsError: string | null;
};

/**
 * @returns {UseUnderfloorHeatingPresetsQueryResult}
 */
export function useUnderfloorHeatingPresetsQuery(): UseUnderfloorHeatingPresetsQueryResult {
  const query = useQuery({
    queryKey: queryKeys.underfloorHeatingPresets,
    queryFn: fetchUnderfloorHeatingPresets,
    staleTime: REFERENCE_STALE_MS,
  });

  return {
    underfloorHeatingBases: query.data?.bases ?? [],
    flooringFinishes: query.data?.finishes ?? [],
    underfloorPresetsLoading: query.isPending,
    underfloorPresetsError: query.error instanceof Error ? query.error.message : null,
  };
}
