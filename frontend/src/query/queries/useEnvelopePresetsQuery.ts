/**
 * Назначение: React Query для пресетов ограждений.
 */

import { useQuery } from '@tanstack/react-query';

import { fetchEnvelopePresets } from '../../services/envelopePresets';
import type { EnvelopePreset } from '../../types/envelope';
import { REFERENCE_STALE_MS } from '../queryClient';
import { queryKeys } from '../queryKeys';

export type UseEnvelopePresetsQueryResult = {
  envelopePresets: EnvelopePreset[];
  presetsLoading: boolean;
  presetsError: string | null;
};

/**
 * @returns {UseEnvelopePresetsQueryResult}
 */
export function useEnvelopePresetsQuery(): UseEnvelopePresetsQueryResult {
  const query = useQuery({
    queryKey: queryKeys.envelopePresets,
    queryFn: fetchEnvelopePresets,
    staleTime: REFERENCE_STALE_MS,
  });

  return {
    envelopePresets: query.data ?? [],
    presetsLoading: query.isPending,
    presetsError: query.error instanceof Error ? query.error.message : null,
  };
}
