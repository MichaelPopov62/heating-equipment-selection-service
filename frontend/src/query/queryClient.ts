/**
 * Назначение: фабрика QueryClient с дефолтами для справочников и calc.
 */

import { QueryClient } from '@tanstack/react-query';

/** Время актуальности справочников (редко меняются на backend). */
const REFERENCE_STALE_MS = 60 * 60 * 1000;

/**
 * @returns {QueryClient}
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export { REFERENCE_STALE_MS };
