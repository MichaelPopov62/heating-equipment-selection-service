/**
 * Назначение: Оркестрация POST /api/v1/calc на клиенте.
 * Описание: Исполнитель calc для SurveySession; uiPhase управляется снаружи.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { postCalc } from '../services/calc.ts';
import type { CalcReportJson } from '../types/calcApi';

/** Задержка debounce автопересчёта, мс. */
export const SURVEY_CALC_DEBOUNCE_MS = 700;

export type UseSurveyCalcRunnerParams = {
  buildCalcPayload: () => unknown;
  canAutoCalc: boolean;
  calcInputKey: string;
  /** Успешный ответ — полная замена отчёта в сессии. */
  onCalcSuccess?: (report: CalcReportJson) => void;
  /** Ошибка — предыдущий отчёт сохраняется в сессии. */
  onCalcError?: (message: string) => void;
  /** Не обнулять локальный report при ошибке (legacy App без сессии). */
  preserveReportOnError?: boolean;
  /** Сессия владеет report; runner только loading + HTTP. */
  managedBySession?: boolean;
  draftInitializing?: boolean;
};

/**
 * HTTP-исполнитель расчёта: debounce, dedup, отмена устаревших запросов.
 */
export function useSurveyCalcRunner({
  buildCalcPayload,
  canAutoCalc,
  calcInputKey,
  onCalcSuccess,
  onCalcError,
  preserveReportOnError = false,
  managedBySession = false,
  draftInitializing = false,
}: UseSurveyCalcRunnerParams) {
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcReport, setCalcReport] = useState<CalcReportJson | null>(null);
  const calcSeqRef = useRef(0);
  const prevCalcInputKeyRef = useRef<string | null>(null);
  const prevCanAutoCalcRef = useRef(canAutoCalc);
  const isDraftInitializingRef = useRef(false);
  const buildCalcPayloadRef = useRef(buildCalcPayload);
  const canAutoCalcRef = useRef(canAutoCalc);
  const debounceTimerRef = useRef<number | null>(null);
  const lastSentPayloadKeyRef = useRef<string | null>(null);
  const onCalcSuccessRef = useRef(onCalcSuccess);
  const onCalcErrorRef = useRef(onCalcError);

  useEffect(() => {
    buildCalcPayloadRef.current = buildCalcPayload;
    canAutoCalcRef.current = canAutoCalc;
    onCalcSuccessRef.current = onCalcSuccess;
    onCalcErrorRef.current = onCalcError;
  }, [buildCalcPayload, canAutoCalc, onCalcSuccess, onCalcError]);

  useEffect(() => {
    if (managedBySession) {
      isDraftInitializingRef.current = draftInitializing;
    }
  }, [draftInitializing, managedBySession]);

  const beginDraftInitialization = useCallback(() => {
    isDraftInitializingRef.current = true;
  }, []);

  const endDraftInitialization = useCallback(() => {
    isDraftInitializingRef.current = false;
  }, []);

  const restoreCalcReport = useCallback((report: CalcReportJson | null) => {
    if (!managedBySession) {
      setCalcReport(report);
    }
    setCalcError(null);
    lastSentPayloadKeyRef.current = null;
  }, [managedBySession]);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const abortInFlightCalc = useCallback(() => {
    calcSeqRef.current += 1;
    clearDebounceTimer();
    setCalcLoading(false);
  }, [clearDebounceTimer]);

  const executeCalcRequest = useCallback(async () => {
    const seq = (calcSeqRef.current += 1);
    setCalcLoading(true);
    setCalcError(null);
    try {
      const payload = buildCalcPayloadRef.current();
      const data = await postCalc(payload);
      if (seq !== calcSeqRef.current) return;
      lastSentPayloadKeyRef.current = JSON.stringify(payload);
      if (managedBySession) {
        onCalcSuccessRef.current?.(data.report);
      } else {
        setCalcReport(data.report);
      }
    } catch (e: unknown) {
      if (seq !== calcSeqRef.current) return;
      const message = e instanceof Error ? e.message : 'Ошибка расчёта';
      if (managedBySession) {
        onCalcErrorRef.current?.(message);
      } else if (preserveReportOnError) {
        setCalcError(message);
      } else {
        setCalcReport(null);
        setCalcError(message);
      }
    } finally {
      if (seq === calcSeqRef.current) {
        setCalcLoading(false);
      }
    }
  }, [managedBySession, preserveReportOnError]);

  const scheduleAutoCalcRef = useRef<() => void>(() => {});

  const scheduleAutoCalc = useCallback(() => {
    clearDebounceTimer();
    if (!canAutoCalcRef.current || isDraftInitializingRef.current) return;

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      const payload = buildCalcPayloadRef.current();
      const payloadKey = JSON.stringify(payload);
      if (payloadKey === lastSentPayloadKeyRef.current) return;

      setCalcError(null);
      void executeCalcRequest();
    }, SURVEY_CALC_DEBOUNCE_MS);
  }, [clearDebounceTimer, executeCalcRequest]);

  useEffect(() => {
    scheduleAutoCalcRef.current = scheduleAutoCalc;
  }, [scheduleAutoCalc]);

  const runApiCalc = useCallback(async () => {
    clearDebounceTimer();
    lastSentPayloadKeyRef.current = null;
    setCalcError(null);
    await executeCalcRequest();
  }, [clearDebounceTimer, executeCalcRequest]);

  const scheduleFreshCalc = useCallback(() => {
    lastSentPayloadKeyRef.current = null;
    scheduleAutoCalc();
  }, [scheduleAutoCalc]);

  useEffect(() => () => clearDebounceTimer(), [clearDebounceTimer]);

  useEffect(() => {
    if (managedBySession) return;

    const wasCanAuto = prevCanAutoCalcRef.current;
    prevCanAutoCalcRef.current = canAutoCalc;

    const isFirstRun = prevCalcInputKeyRef.current === null;
    if (isFirstRun) {
      prevCalcInputKeyRef.current = calcInputKey;
      if (canAutoCalc && !isDraftInitializingRef.current) {
        scheduleAutoCalcRef.current();
      }
      return;
    }

    const keyChanged = prevCalcInputKeyRef.current !== calcInputKey;
    const canAutoJustEnabled = !wasCanAuto && canAutoCalc;

    if (!keyChanged && !canAutoJustEnabled) return;

    prevCalcInputKeyRef.current = calcInputKey;

    if (isDraftInitializingRef.current) return;

    if (!canAutoCalc) {
      if (keyChanged) {
        setCalcReport(null);
        setCalcError(null);
      }
      return;
    }

    scheduleAutoCalcRef.current();
  }, [calcInputKey, canAutoCalc, managedBySession]);

  useEffect(() => {
    if (!managedBySession) return;

    const wasCanAuto = prevCanAutoCalcRef.current;
    prevCanAutoCalcRef.current = canAutoCalc;

    const isFirstRun = prevCalcInputKeyRef.current === null;
    if (isFirstRun) {
      prevCalcInputKeyRef.current = calcInputKey;
      return;
    }

    const keyChanged = prevCalcInputKeyRef.current !== calcInputKey;
    const canAutoJustEnabled = !wasCanAuto && canAutoCalc;

    if (!keyChanged && !canAutoJustEnabled) return;

    prevCalcInputKeyRef.current = calcInputKey;

    if (isDraftInitializingRef.current) return;
    if (!canAutoCalc) {
      abortInFlightCalc();
      return;
    }

    scheduleAutoCalcRef.current();
  }, [abortInFlightCalc, calcInputKey, canAutoCalc, managedBySession]);

  return {
    calcLoading,
    calcError,
    calcReport: managedBySession ? null : calcReport,
    setCalcReport,
    beginDraftInitialization,
    endDraftInitialization,
    restoreCalcReport,
    runApiCalc,
    scheduleFreshCalc,
    abortInFlightCalc,
  };
}
