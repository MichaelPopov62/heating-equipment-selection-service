/**
 * Назначение: React Query для GET /api/v1/me (профиль и tier).
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../auth/useAuth';
import { fetchMe, MeApiError } from '../../services/meApi';
import type { MeUser } from '../../types/meApi';
import { queryKeys } from '../queryKeys';

const ME_STALE_MS = 60_000;

export type UseMeQueryResult = {
  user: MeUser | null;
  meLoading: boolean;
  meError: Error | null;
  refetch: () => Promise<unknown>;
};

/**
 * enabled = isMeQueryEnabled — Bearer getter готов (Clerk isLoaded), без гонки 401.
 *
 * @returns {UseMeQueryResult}
 */
export function useMeQuery(): UseMeQueryResult {
  const { isMeQueryEnabled } = useAuth();

  const enabled = isMeQueryEnabled;

  const query = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    enabled,
    staleTime: ME_STALE_MS,
    retry: (failureCount, error) => {
      if (error instanceof MeApiError && error.statusCode === 401) {
        return false;
      }
      return failureCount < 1;
    },
  });

  return {
    user: query.data?.user ?? null,
    meLoading: enabled && (query.isPending || query.isFetching),
    meError: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
}
