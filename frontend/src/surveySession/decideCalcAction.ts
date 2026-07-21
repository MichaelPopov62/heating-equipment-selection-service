/**
 * Назначение: решение о запуске calc после мутации.
 */

import type { SurveyCalcAction, SurveyMutation, SurveySessionState } from './types';
import { canAutoCalcFromDraft } from './buildCalcInputSnapshot';

/**
 * @param prev
 * @param next
 * @param mutation
 * @returns {SurveyCalcAction}
 */
export function decideCalcAction(
  prev: SurveySessionState,
  next: SurveySessionState,
  mutation: SurveyMutation,
): SurveyCalcAction {
  if (next.draftInitializing) {
    return 'none';
  }

  if (mutation.type === 'RUN_CALC_MANUAL') {
    return canAutoCalcFromDraft(next.draft) ? 'schedule_immediate' : 'none';
  }

  if (mutation.type === 'DRAFT_LOADED') {
    return canAutoCalcFromDraft(next.draft) ? 'schedule' : 'none';
  }

  if (mutation.type === 'SESSION_RESET') {
    return 'abort_only';
  }

  if (mutation.type === 'SURVEY_STARTED') {
    return 'none';
  }

  const keyChanged = prev.calcInputKey !== next.calcInputKey;
  const canAuto = canAutoCalcFromDraft(next.draft);
  const wasCanAuto = canAutoCalcFromDraft(prev.draft);

  if (!keyChanged && !(canAuto && !wasCanAuto)) {
    return 'none';
  }

  if (!canAuto) {
    return 'abort_only';
  }

  return 'schedule';
}
