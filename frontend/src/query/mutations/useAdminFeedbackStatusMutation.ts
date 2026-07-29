/**
 * Назначение: mutation статуса admin feedback и обновление списков.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateAdminFeedbackStatus } from '../../services/adminFeedbackApi';
import type { AdminFeedbackStatus } from '../../types/adminFeedback';
import { queryKeys } from '../queryKeys';

export type UpdateAdminFeedbackStatusParams = {
  id: string;
  status: AdminFeedbackStatus;
};

/**
 * Mutation статуса с последующей синхронизацией всех активных фильтров.
 */
export function useAdminFeedbackStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: UpdateAdminFeedbackStatusParams) =>
      updateAdminFeedbackStatus(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminFeedbackRoot });
    },
  });
}
