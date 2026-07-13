/**
 * Назначение: оркестрация POST /api/v1/calc через React Query.
 * Описание: автопересчёт (useQuery + debounce) и ручной расчёт (useMutation).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { postCalc } from '../services/calc';
import type { CalcReportJson } from '../types/calcApi';
import { queryKeys } from './queryKeys';
import { useDebouncedValue } from './useDebouncedValue';

/** Задержка debounce автопересчёта, мс. */
export const SURVEY_CALC_DEBOUNCE_MS = 700;

const CALC_SKIP_DEDUP = '__CALC_SKIP_DEDUP__';

export type UseSurveyCalcParams = {
  buildCalcPayload: () => unknown;
  canAutoCalc: boolean;
  calcInputKey: string;
  onCalcSuccess?: (report: CalcReportJson) => void;
  onCalcError?: (message: string) => void;
  /** Payload совпал с последним успешным — снять uiPhase=recalculating. */
  onCalcSkippedDedup?: () => void;
  draftInitializing?: boolean;
};

/**
 * HTTP-исполнитель расчёта для SurveySession.
 */
export function useSurveyCalc({
  buildCalcPayload,
  canAutoCalc,
  calcInputKey,
  onCalcSuccess,
  onCalcError,
  onCalcSkippedDedup,
  draftInitializing = false,
}: UseSurveyCalcParams) {
  const queryClient = useQueryClient();
  const buildCalcPayloadRef = useRef(buildCalcPayload);
  const onCalcSuccessRef = useRef(onCalcSuccess);
  const onCalcErrorRef = useRef(onCalcError);
  const onCalcSkippedDedupRef = useRef(onCalcSkippedDedup);
  const lastSuccessPayloadKeyRef = useRef<string | null>(null);
  const [freshCalcToken, setFreshCalcToken] = useState(0);

  useEffect(() => {
    buildCalcPayloadRef.current = buildCalcPayload;
    onCalcSuccessRef.current = onCalcSuccess;
    onCalcErrorRef.current = onCalcError;
    onCalcSkippedDedupRef.current = onCalcSkippedDedup;
  }, [buildCalcPayload, onCalcSuccess, onCalcError, onCalcSkippedDedup]);

  const debouncedKey = useDebouncedValue(calcInputKey, SURVEY_CALC_DEBOUNCE_MS);

  const autoEnabled =
    canAutoCalc &&
    !draftInitializing &&
    debouncedKey === calcInputKey &&
    calcInputKey.length > 0;

  const autoQuery = useQuery({
    queryKey: [...queryKeys.calc(debouncedKey), freshCalcToken],
    queryFn: async () => {
      const payload = buildCalcPayloadRef.current();
      const payloadKey = JSON.stringify(payload);
      if (payloadKey === lastSuccessPayloadKeyRef.current) {
        throw new Error(CALC_SKIP_DEDUP);
      }
      const data = await postCalc(payload);
      lastSuccessPayloadKeyRef.current = payloadKey;
      return data.report;
    },
    enabled: autoEnabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (!autoQuery.data || autoQuery.isFetching) return;
    onCalcSuccessRef.current?.(autoQuery.data);
  }, [autoQuery.data, autoQuery.dataUpdatedAt, autoQuery.isFetching]);

  useEffect(() => {
    if (!autoQuery.error || autoQuery.isFetching) return;
    if (autoQuery.error instanceof Error && autoQuery.error.message === CALC_SKIP_DEDUP) {
      onCalcSkippedDedupRef.current?.();
      return;
    }
    const message =
      autoQuery.error instanceof Error ? autoQuery.error.message : 'Ошибка расчёта';
    onCalcErrorRef.current?.(message);
  }, [autoQuery.error, autoQuery.errorUpdatedAt, autoQuery.isFetching]);

  const manualMutation = useMutation({
    mutationFn: async () => {
      const payload = buildCalcPayloadRef.current();
      const data = await postCalc(payload);
      lastSuccessPayloadKeyRef.current = JSON.stringify(payload);
      return data.report;
    },
    onSuccess: (report) => {
      onCalcSuccessRef.current?.(report);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Ошибка расчёта';
      onCalcErrorRef.current?.(message);
    },
  });

  const { mutateAsync: mutateCalcManual, reset: resetManualCalc, isPending: manualCalcPending } =
    manualMutation;

  const clearDebounceAndCancel = useCallback(() => {
    void queryClient.cancelQueries({ queryKey: queryKeys.calcRoot });
    resetManualCalc();
  }, [queryClient, resetManualCalc]);

  const abortInFlightCalc = useCallback(() => {
    clearDebounceAndCancel();
  }, [clearDebounceAndCancel]);

  const scheduleFreshCalc = useCallback(() => {
    lastSuccessPayloadKeyRef.current = null;
    setFreshCalcToken((token) => token + 1);
  }, []);

  const runApiCalc = useCallback(async () => {
    clearDebounceAndCancel();
    lastSuccessPayloadKeyRef.current = null;
    await mutateCalcManual();
  }, [clearDebounceAndCancel, mutateCalcManual]);

  useEffect(() => {
    if (!canAutoCalc) {
      abortInFlightCalc();
    }
  }, [canAutoCalc, abortInFlightCalc]);

  const autoError =
    autoQuery.error instanceof Error && autoQuery.error.message !== CALC_SKIP_DEDUP
      ? autoQuery.error.message
      : null;
  const manualError =
    manualMutation.error instanceof Error ? manualMutation.error.message : null;

  return {
    calcLoading: autoQuery.isFetching || manualCalcPending,
    calcError: manualError ?? autoError,
    scheduleFreshCalc,
    runApiCalc,
    abortInFlightCalc,
  };
}
