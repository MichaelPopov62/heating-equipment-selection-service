/**
 * Назначение: React Query для снимка каталога оборудования.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  fetchCatalogEquipment,
  type CatalogEquipmentSnapshot,
} from '../../services/catalog';
import { queryKeys } from '../queryKeys';

const CATALOG_STALE_MS = 10 * 60 * 1000;

export type UseCatalogEquipmentQueryResult = {
  catalogSnap: CatalogEquipmentSnapshot | null;
  catalogSnapLoading: boolean;
  catalogSnapError: string | null;
  reloadCatalog: () => Promise<void>;
};

/**
 * @returns {UseCatalogEquipmentQueryResult}
 */
export function useCatalogEquipmentQuery(): UseCatalogEquipmentQueryResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.catalog,
    queryFn: () => fetchCatalogEquipment(),
    staleTime: CATALOG_STALE_MS,
  });

  const reloadCatalog = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.catalog });
    await query.refetch();
  }, [queryClient, query]);

  return {
    catalogSnap: query.data ?? null,
    catalogSnapLoading: query.isPending,
    catalogSnapError: query.error instanceof Error ? query.error.message : null,
    reloadCatalog,
  };
}
