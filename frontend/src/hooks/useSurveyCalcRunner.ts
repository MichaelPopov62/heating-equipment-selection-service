/**
 * Назначение: Оркестрация POST /api/v1/calc на клиенте.
 * Описание: Состояние отчёта, сброс при смене calcInputKey, debounce-автопересчёт, guard загрузки черновика.
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
};

/**
 * Управление жизненным циклом расчёта анкеты: loading/error/report и автозапрос к API.
 */
export function useSurveyCalcRunner({
  buildCalcPayload,
  canAutoCalc,
  calcInputKey,
}: UseSurveyCalcRunnerParams) {
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcReport, setCalcReport] = useState<CalcReportJson | null>(null);
  const calcSeqRef = useRef(0);
  const prevCalcInputKeyRef = useRef<string | null>(null);
  const prevCanAutoCalcRef = useRef(canAutoCalc);
  /** Guard: не сбрасывать отчёт и не запускать автопересчёт при программной загрузке черновика. */
  const isDraftInitializingRef = useRef(false);
  const buildCalcPayloadRef = useRef(buildCalcPayload);
  const canAutoCalcRef = useRef(canAutoCalc);
  const debounceTimerRef = useRef<number | null>(null);
  /** JSON последнего успешно отправленного CalcInput — защита от лишних POST при том же теле. */
  const lastSentPayloadKeyRef = useRef<string | null>(null);

  useEffect(() => {
    buildCalcPayloadRef.current = buildCalcPayload;
    canAutoCalcRef.current = canAutoCalc;
  }, [buildCalcPayload, canAutoCalc]);

  /**
   * Вызвать в начале applySurveyDraftState (до пачки setState), чтобы сохранить lastCalcReport.
   */
  const beginDraftInitialization = useCallback(() => {
    isDraftInitializingRef.current = true;
  }, []);

  /** Снять guard после применения всех setState из черновика (см. applySurveyDraftState). */
  const endDraftInitialization = useCallback(() => {
    isDraftInitializingRef.current = false;
  }, []);

  /** Восстановление отчёта из черновика или сохранённого расчёта проекта. */
  const restoreCalcReport = useCallback((report: CalcReportJson | null) => {
    setCalcReport(report);
    setCalcError(null);
    lastSentPayloadKeyRef.current = null;
  }, []);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const executeCalcRequest = useCallback(async () => {
    const seq = (calcSeqRef.current += 1);
    setCalcLoading(true);
    setCalcError(null);
    try {
      const payload = buildCalcPayloadRef.current();
      const data = await postCalc(payload);
      if (seq !== calcSeqRef.current) return;
      lastSentPayloadKeyRef.current = JSON.stringify(payload);
      setCalcReport(data.report);
    } catch (e: unknown) {
      if (seq !== calcSeqRef.current) return;
      setCalcReport(null);
      setCalcError(e instanceof Error ? e.message : 'Ошибка расчёта');
    } finally {
      if (seq === calcSeqRef.current) {
        setCalcLoading(false);
      }
    }
  }, []);

  const scheduleAutoCalcRef = useRef<() => void>(() => {});

  const scheduleAutoCalc = useCallback(() => {
    clearDebounceTimer();
    if (!canAutoCalcRef.current || isDraftInitializingRef.current) return;

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      const payload = buildCalcPayloadRef.current();
      const payloadKey = JSON.stringify(payload);
      if (payloadKey === lastSentPayloadKeyRef.current) return;

      setCalcReport(null);
      setCalcError(null);
      void executeCalcRequest();
    }, SURVEY_CALC_DEBOUNCE_MS);
  }, [clearDebounceTimer, executeCalcRequest]);

  useEffect(() => {
    scheduleAutoCalcRef.current = scheduleAutoCalc;
  }, [scheduleAutoCalc]);

  const runApiCalc = useCallback(async () => {
    clearDebounceTimer();
    setCalcReport(null);
    setCalcError(null);
    await executeCalcRequest();
  }, [clearDebounceTimer, executeCalcRequest]);

  useEffect(() => () => clearDebounceTimer(), [clearDebounceTimer]);

  /**
   * Автопересчёт при смене calcInputKey или при первом включении canAutoCalc.
   * Лишний POST не уходит, если JSON CalcInput совпадает с последним успешным (типично при ГВС/оркестрации комнат).
   */
  useEffect(() => {
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
      if (keyChanged) {
        setCalcReport(null);
        setCalcError(null);
      }
      return;
    }

    scheduleAutoCalcRef.current();
  }, [calcInputKey, canAutoCalc]);

  return {
    calcLoading,
    calcError,
    calcReport,
    setCalcReport,
    beginDraftInitialization,
    endDraftInitialization,
    restoreCalcReport,
    runApiCalc,
  };
}
