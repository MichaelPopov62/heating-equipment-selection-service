/**
 * Назначение: композиция справочных React Query для корня приложения.
 */

import { useEnvelopePresetsQuery } from './queries/useEnvelopePresetsQuery';
import { useUnderfloorHeatingPresetsQuery } from './queries/useUnderfloorHeatingPresetsQuery';
import { useUfhModePresetsQuery } from './queries/useUfhModePresetsQuery';

export type UseReferenceDataOptions = {
  /** false — не загружать справочники (Start Screen, /projects). */
  enabled?: boolean;
};

export type UseReferenceDataResult = ReturnType<typeof useEnvelopePresetsQuery> &
  ReturnType<typeof useUnderfloorHeatingPresetsQuery> &
  ReturnType<typeof useUfhModePresetsQuery>;

/**
 * @param options
 * @returns {UseReferenceDataResult}
 */
export function useReferenceData(options: UseReferenceDataOptions = {}): UseReferenceDataResult {
  const enabled = options.enabled ?? true;
  const envelope = useEnvelopePresetsQuery({ enabled });
  const underfloor = useUnderfloorHeatingPresetsQuery({ enabled });
  const ufhModes = useUfhModePresetsQuery({ enabled });

  return {
    ...envelope,
    ...underfloor,
    ...ufhModes,
  };
}
