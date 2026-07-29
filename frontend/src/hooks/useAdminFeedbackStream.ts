/**
 * Назначение: жизненный цикл SSE admin feedback, reconnect и локальное уведомление.
 */

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { adminFeedbackUk } from '../i18n/uk/adminFeedback';
import { AdminFeedbackApiError } from '../services/adminFeedbackApi';
import { streamAdminFeedback } from '../services/adminFeedbackStream';
import { queryKeys } from '../query/queryKeys';

export type AdminFeedbackStreamState = 'connecting' | 'connected' | 'reconnecting' | 'unavailable';

export type UseAdminFeedbackStreamResult = {
  streamState: AdminFeedbackStreamState;
  toastMessage: string | null;
  dismissToast: () => void;
};

const MAX_RECONNECT_DELAY_MS = 30_000;
const TOAST_DURATION_MS = 8_000;

/**
 * @param error
 */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Поддерживает live-подписку, пока admin dashboard смонтирован.
 */
export function useAdminFeedbackStream(): UseAdminFeedbackStreamResult {
  const queryClient = useQueryClient();
  const [streamState, setStreamState] = useState<AdminFeedbackStreamState>('connecting');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let reconnectTimer: number | null = null;
    let toastTimer: number | null = null;
    let reconnectAttempt = 0;

    const connect = async (): Promise<void> => {
      if (controller.signal.aborted) return;
      setStreamState(reconnectAttempt === 0 ? 'connecting' : 'reconnecting');

      try {
        await streamAdminFeedback({
          signal: controller.signal,
          onOpen: () => {
            reconnectAttempt = 0;
            setStreamState('connected');
            void queryClient.invalidateQueries({ queryKey: queryKeys.adminFeedbackRoot });
          },
          onCreated: (item) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.adminFeedbackRoot });
            setToastMessage(
              item.type === 'bug'
                ? adminFeedbackUk.toastBugCreated
                : adminFeedbackUk.toastContactCreated,
            );
            if (toastTimer !== null) window.clearTimeout(toastTimer);
            toastTimer = window.setTimeout(() => {
              setToastMessage(null);
            }, TOAST_DURATION_MS);
          },
        });
        throw new Error('Live-потік було закрито сервером');
      } catch (error: unknown) {
        if (isAbortError(error)) return;
        if (
          error instanceof AdminFeedbackApiError &&
          (error.statusCode === 401 || error.statusCode === 403)
        ) {
          setStreamState('unavailable');
          return;
        }

        setStreamState('reconnecting');
        const delay = Math.min(1_000 * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS);
        reconnectAttempt += 1;
        reconnectTimer = window.setTimeout(() => {
          void connect();
        }, delay);
      }
    };

    void connect();

    return () => {
      controller.abort();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (toastTimer !== null) window.clearTimeout(toastTimer);
    };
  }, [queryClient]);

  return {
    streamState,
    toastMessage,
    dismissToast: () => {
      setToastMessage(null);
    },
  };
}
