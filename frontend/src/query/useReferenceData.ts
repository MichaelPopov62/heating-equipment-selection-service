/**
 * Назначение: композиция справочных React Query для корня приложения.
 */

import { useEnvelopePresetsQuery } from './queries/useEnvelopePresetsQuery';
import { useUnderfloorHeatingPresetsQuery } from './queries/useUnderfloorHeatingPresetsQuery';
import { useUfhModePresetsQuery } from './queries/useUfhModePresetsQuery';

export type UseReferenceDataResult = ReturnType<typeof useEnvelopePresetsQuery> &
  ReturnType<typeof useUnderfloorHeatingPresetsQuery> &
  ReturnType<typeof useUfhModePresetsQuery>;

/**
 * @returns {UseReferenceDataResult}
 */
export function useReferenceData(): UseReferenceDataResult {
  const envelope = useEnvelopePresetsQuery();
  const underfloor = useUnderfloorHeatingPresetsQuery();
  const ufhModes = useUfhModePresetsQuery();

  return {
    ...envelope,
    ...underfloor,
    ...ufhModes,
  };
}
