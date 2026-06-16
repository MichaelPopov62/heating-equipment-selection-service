/**
 * Назначение: Хук загрузки каталога оборудования.
 * Описание: Снимок каталога для UI и функция reloadCatalog по требованию.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  fetchCatalogEquipment,
  type CatalogEquipmentSnapshot,
} from '../services/catalog';

export function useCatalogEquipmentLoader() {
  const [catalogSnap, setCatalogSnap] =
    useState<CatalogEquipmentSnapshot | null>(null);
  const [catalogSnapLoading, setCatalogSnapLoading] = useState(true);
  const [catalogSnapError, setCatalogSnapError] = useState<string | null>(null);

  const loadCatalog = useCallback(async (force = false) => {
    setCatalogSnapLoading(true);
    setCatalogSnapError(null);
    try {
      const snap = await fetchCatalogEquipment(force);
      setCatalogSnap(snap);
    } catch (e) {
      setCatalogSnap(null);
      setCatalogSnapError(e instanceof Error ? e.message : String(e));
    } finally {
      setCatalogSnapLoading(false);
    }
  }, []);

  const reloadCatalog = useCallback(async () => {
    await loadCatalog(true);
  }, [loadCatalog]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadCatalog(false);
    });
  }, [loadCatalog]);

  return { catalogSnap, catalogSnapLoading, catalogSnapError, reloadCatalog };
}
