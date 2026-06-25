/**
 * Назначение: Оркестрация POST /api/v1/calc на клиенте.
 * Описание: Состояние отчёта, debounce-автопересчёт, инвалидация и защита от гонок запросов.
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

  /** Сброс отчёта при изменении входных данных формы (без очистки calcError). */
  const invalidateCalcReport = useCallback(() => {
    setCalcReport(null);
  }, []);

  /** Восстановление отчёта из черновика или сохранённого расчёта проекта. */
  const restoreCalcReport = useCallback((report: CalcReportJson | null) => {
    setCalcReport(report);
    setCalcError(null);
  }, []);

  const runApiCalc = useCallback(async () => {
    const seq = (calcSeqRef.current += 1);
    setCalcLoading(true);
    setCalcError(null);
    try {
      const data = await postCalc(buildCalcPayload());
      if (seq !== calcSeqRef.current) return;
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
  }, [buildCalcPayload]);

  useEffect(() => {
    if (!canAutoCalc) return;
    const timerId = window.setTimeout(() => {
      void runApiCalc();
    }, SURVEY_CALC_DEBOUNCE_MS);
    return () => window.clearTimeout(timerId);
  }, [canAutoCalc, calcInputKey, runApiCalc]);

  return {
    calcLoading,
    calcError,
    calcReport,
    setCalcReport,
    invalidateCalcReport,
    restoreCalcReport,
    runApiCalc,
  };
}
