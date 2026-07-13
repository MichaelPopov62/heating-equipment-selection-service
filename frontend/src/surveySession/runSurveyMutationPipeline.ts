/**
 * Назначение: единый pipeline мутации анкеты (шаги 1–4).
 */

import { buildCalcInputKeyFromDraft } from './buildCalcInputSnapshot';
import { decideCalcAction } from './decideCalcAction';
import { migrateDerivedState } from './migrateDerivedState';
import { reduceSurveyMutation } from './reduceSurveyMutation';
import type {
  SurveyMutation,
  SurveyPipelineResult,
  SurveySessionState,
  SurveyUiPhase,
} from './types';

/**
 * @param prev
 * @param mutation
 * @returns {SurveyPipelineResult}
 */
export function runSurveyMutationPipeline(
  prev: SurveySessionState,
  mutation: SurveyMutation,
): SurveyPipelineResult {
  let draft = reduceSurveyMutation(prev.draft, mutation);
  draft = migrateDerivedState(draft, mutation);

  let thermalRegimeTouched = prev.thermalRegimeTouched;
  if (mutation.type === 'SET_THERMAL_REGIME_PRESET' && mutation.touched) {
    thermalRegimeTouched = true;
  }
  if (mutation.type === 'DRAFT_LOADED') {
    thermalRegimeTouched = true;
  }

  let draftInitializing = prev.draftInitializing;
  if (mutation.type === 'DRAFT_LOADED') {
    draftInitializing = true;
  }

  let report = prev.report;
  let reportEpoch = prev.reportEpoch;
  let uiPhase: SurveyUiPhase = prev.uiPhase;
  let calcError = prev.calcError;

  if (mutation.type === 'DRAFT_LOADED') {
    report = mutation.lastCalcReport ?? null;
    reportEpoch += 1;
    uiPhase = report != null ? 'stable' : 'idle';
    calcError = null;
  }

  const calcInputKey = buildCalcInputKeyFromDraft(draft);

  const interim: SurveySessionState = {
    draft,
    report,
    reportEpoch,
    uiPhase,
    calcError,
    draftInitializing,
    thermalRegimeTouched,
    calcInputKey,
  };

  const calcAction = decideCalcAction(prev, interim, mutation);

  if (calcAction === 'schedule' || calcAction === 'schedule_immediate') {
    uiPhase = 'recalculating';
    calcError = null;
  } else if (calcAction === 'abort_only') {
    uiPhase = report != null ? 'stable' : 'idle';
  }

  if (
    mutation.type === 'DRAFT_LOADED'
    && calcAction === 'schedule'
  ) {
    draftInitializing = true;
  }

  return {
    state: {
      ...interim,
      uiPhase,
      calcError,
      draftInitializing,
      thermalRegimeTouched,
    },
    calcAction,
  };
}

/**
 * Завершение загрузки черновика (снятие guard).
 *
 * @param state
 * @returns {SurveySessionState}
 */
export function endDraftInitializationPhase(
  state: SurveySessionState,
): SurveySessionState {
  return { ...state, draftInitializing: false };
}

/**
 * Успешный ответ calc API — полная замена отчёта.
 *
 * @param state
 * @param report
 * @returns {SurveySessionState}
 */
export function applyCalcResponseOk(
  state: SurveySessionState,
  report: import('../types/calcApi').CalcReportJson,
): SurveySessionState {
  return {
    ...state,
    report,
    reportEpoch: state.reportEpoch + 1,
    uiPhase: 'stable',
    calcError: null,
  };
}

/**
 * Ошибка calc — сохраняем предыдущий отчёт.
 *
 * @param state
 * @param message
 * @returns {SurveySessionState}
 */
export function applyCalcResponseFail(
  state: SurveySessionState,
  message: string,
): SurveySessionState {
  return {
    ...state,
    uiPhase: 'error',
    calcError: message,
  };
}

/**
 * Dedup payload: POST не нужен — снимаем recalculating, отчёт без изменений.
 *
 * @param state
 * @returns {SurveySessionState}
 */
export function applyCalcSkippedDedup(state: SurveySessionState): SurveySessionState {
  return {
    ...state,
    uiPhase: state.report != null ? 'stable' : 'idle',
    calcError: null,
  };
}
