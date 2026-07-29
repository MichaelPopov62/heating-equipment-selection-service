/**
 * Назначение: cursor-pagination списка admin feedback через React Query.
 */

import { useInfiniteQuery } from '@tanstack/react-query';

import { listAdminFeedback } from '../../services/adminFeedbackApi';
import type {
  AdminFeedbackItem,
  AdminFeedbackStatus,
  AdminFeedbackType,
} from '../../types/adminFeedback';
import { queryKeys } from '../queryKeys';

const DEFAULT_LIMIT = 30;

export type AdminFeedbackFilters = {
  status?: AdminFeedbackStatus;
  type?: AdminFeedbackType;
};

export type UseAdminFeedbackQueryResult = {
  items: AdminFeedbackItem[];
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  error: Error | null;
  hasNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
};

/**
 * @param filters
 */
export function useAdminFeedbackQuery(
  filters: AdminFeedbackFilters,
): UseAdminFeedbackQueryResult {
  const query = useInfiniteQuery({
    queryKey: queryKeys.adminFeedback({ ...filters, limit: DEFAULT_LIMIT }),
    queryFn: ({ pageParam }) =>
      listAdminFeedback({
        ...filters,
        limit: DEFAULT_LIMIT,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 0,
  });

  const uniqueItems = new Map<string, AdminFeedbackItem>();
  for (const page of query.data?.pages ?? []) {
    for (const item of page.items) uniqueItems.set(item.id, item);
  }

  return {
    items: [...uniqueItems.values()],
    isLoading: query.isPending,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error instanceof Error ? query.error : null,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}
