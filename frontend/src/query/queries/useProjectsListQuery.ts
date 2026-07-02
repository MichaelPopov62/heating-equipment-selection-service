/**
 * Назначение: React Query для списка проектов.
 */

import { useQuery } from '@tanstack/react-query';

import { listProjects } from '../../services/projectsApi';
import type { ProjectListItem } from '../../types/projectsApi';
import { queryKeys } from '../queryKeys';

export type UseProjectsListQueryParams = {
  enabled: boolean;
  limit?: number;
};

export type UseProjectsListQueryResult = {
  projectList: ProjectListItem[];
  projectsLoading: boolean;
  projectsError: Error | null;
  refetch: () => Promise<unknown>;
};

/**
 * @param params
 * @returns {UseProjectsListQueryResult}
 */
export function useProjectsListQuery({
  enabled,
  limit = 50,
}: UseProjectsListQueryParams): UseProjectsListQueryResult {
  const query = useQuery({
    queryKey: queryKeys.projects({ limit }),
    queryFn: () => listProjects({ limit }),
    enabled,
    staleTime: 0,
  });

  return {
    projectList: query.data?.projects ?? [],
    projectsLoading: query.isPending || query.isFetching,
    projectsError: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
}
