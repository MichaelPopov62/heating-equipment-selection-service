/**
 * Назначение: синхронизация кеша React Query профиля /me при login/logout.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { queryKeys } from '../query/queryKeys';

export type AuthMeCacheSync = {
  refreshMeProfile: () => void;
  clearMeProfile: () => void;
};

/**
 * @returns {AuthMeCacheSync}
 */
export function useAuthMeCacheSync(): AuthMeCacheSync {
  const queryClient = useQueryClient();

  const refreshMeProfile = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.me });
  }, [queryClient]);

  const clearMeProfile = useCallback(() => {
    queryClient.removeQueries({ queryKey: queryKeys.me });
  }, [queryClient]);

  return { refreshMeProfile, clearMeProfile };
}
