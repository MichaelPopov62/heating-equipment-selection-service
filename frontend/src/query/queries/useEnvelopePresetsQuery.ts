/**
 * Назначение: React Query для пресетов ограждений.
 */

import { useQuery } from '@tanstack/react-query';

import { fetchEnvelopePresets } from '../../services/envelopePresets';
import type { EnvelopePreset } from '../../types/envelope';
import { REFERENCE_STALE_MS } from '../queryClient';
import { queryKeys } from '../queryKeys';

export type UseEnvelopePresetsQueryOptions = {
  /** false — не запрашивать API (Start Screen на главной). */
  enabled?: boolean;
};

export type UseEnvelopePresetsQueryResult = {
  envelopePresets: EnvelopePreset[];
  presetsLoading: boolean;
  presetsError: string | null;
};

/**
 * @param options
 * @returns {UseEnvelopePresetsQueryResult}
 */
export function useEnvelopePresetsQuery(
  options: UseEnvelopePresetsQueryOptions = {},
): UseEnvelopePresetsQueryResult {
  const enabled = options.enabled ?? true;
  const query = useQuery({
    queryKey: queryKeys.envelopePresets,
    queryFn: fetchEnvelopePresets,
    staleTime: REFERENCE_STALE_MS,
    enabled,
  });

  return {
    envelopePresets: query.data ?? [],
    presetsLoading: enabled && query.isLoading,
    presetsError: query.error instanceof Error ? query.error.message : null,
  };
}
