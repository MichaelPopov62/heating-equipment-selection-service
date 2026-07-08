/**
 * Назначение: порядок шагов анкеты (UI-навигация и валидация черновика).
 */

import type { SurveyCurrentStep } from '../types/surveyStep';

/** Канонический порядок шагов survey (SSOT для migrateSurveyDraft и навигации). */
const SURVEY_STEPS: readonly SurveyCurrentStep[] = [
  'object',
  'rooms',
  'hotWater',
  'boiler',
  'warmFloor',
  'radiators',
  'waterHeater',
  'hydraulics',
  'summary',
];

/**
 * @param v
 * @returns {v is SurveyCurrentStep}
 */
export function isSurveyStep(v: unknown): v is SurveyCurrentStep {
  return typeof v === 'string' && (SURVEY_STEPS as readonly string[]).includes(v);
}
