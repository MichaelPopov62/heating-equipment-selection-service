/**
 * Назначение: React Query для списка расчётов проекта.
 */

import { useQuery } from '@tanstack/react-query';

import { listProjectCalculations } from '../../services/projectsApi';
import type { CalculationListItem } from '../../types/projectsApi';
import { queryKeys } from '../queryKeys';

export type UseProjectCalculationsQueryParams = {
  projectId: string | null;
  enabled: boolean;
  limit?: number;
};

export type UseProjectCalculationsQueryResult = {
  calculations: CalculationListItem[];
  calculationsLoading: boolean;
  refetch: () => Promise<unknown>;
};

/**
 * @param params
 * @returns {UseProjectCalculationsQueryResult}
 */
export function useProjectCalculationsQuery({
  projectId,
  enabled,
  limit = 10,
}: UseProjectCalculationsQueryParams): UseProjectCalculationsQueryResult {
  const query = useQuery({
    queryKey: queryKeys.projectCalculations(projectId ?? ''),
    queryFn: () => listProjectCalculations(projectId!, { limit }),
    enabled: enabled && projectId != null && projectId.length > 0,
    staleTime: 0,
  });

  return {
    calculations: query.data?.calculations ?? [],
    calculationsLoading: query.isPending || query.isFetching,
    refetch: query.refetch,
  };
}
