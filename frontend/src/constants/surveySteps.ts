/**
 * Назначение: порядок шагов анкеты (UI-навигация и валидация черновика).
 * Описание: SSOT для боковой навигации, migrateSurveyDraft и isSurveyStep.
 * Порядок: object → warmFloor → rooms → hotWater → boiler → radiators →
 * waterHeater → hydraulics → summary (ТП до помещений: флаг / ufhPresetId).
 */

import type { SurveyCurrentStep } from '../types/surveyStep';

/** Подписи пунктов боковой навигации. */
const SURVEY_STEP_NAV_LABELS: Record<SurveyCurrentStep, string> = {
  object: 'Объект',
  rooms: 'Помещения',
  hotWater: 'Горячая вода',
  boiler: 'Котёл',
  warmFloor: 'Тёплый пол',
  radiators: 'Радиаторы',
  waterHeater: 'Водонагреватель',
  hydraulics: 'Гидравлика',
  summary: 'Итог',
};

/** Заголовок блока globalMeta; для шагов без записи — «Параметры объекта». */
const SURVEY_STEP_GLOBAL_META_TITLES: Partial<Record<SurveyCurrentStep, string>> = {
  rooms: 'Параметры помещений',
  hotWater: 'Объект и горячая вода',
  boiler: 'Котёл: температурный график отопления',
  waterHeater: 'Водонагреватель и сценарий ГВС',
  warmFloor: 'Тёплый пол и низкотемпературный контур',
  hydraulics: 'Гидравлика и разводка',
};

const DEFAULT_GLOBAL_META_TITLE = 'Параметры объекта';

/** Канонический порядок шагов survey (SSOT для migrateSurveyDraft и навигации). */
export const SURVEY_STEPS: readonly SurveyCurrentStep[] = [
  'object',
  'warmFloor',
  'rooms',
  'hotWater',
  'boiler',
  'radiators',
  'waterHeater',
  'hydraulics',
  'summary',
];

/** Пункты боковой навигации (порядок = SURVEY_STEPS). */
export const SURVEY_STEP_NAV_ITEMS: ReadonlyArray<{
  step: SurveyCurrentStep;
  label: string;
}> = SURVEY_STEPS.map((step) => ({
  step,
  label: SURVEY_STEP_NAV_LABELS[step],
}));

/**
 * @param v
 * @returns {v is SurveyCurrentStep}
 */
export function isSurveyStep(v: unknown): v is SurveyCurrentStep {
  return typeof v === 'string' && (SURVEY_STEPS as readonly string[]).includes(v);
}

/**
 * Шаги, на которых в DEV показывается панель ручного POST /api/v1/calc
 * (все кроме «Объект»). В production UI бар скрыт — расчёт идёт автоматически.
 *
 * @param step
 */
export function isCalcApiBarStep(step: SurveyCurrentStep): boolean {
  return step !== 'object';
}

/**
 * Заголовок секции globalMeta для текущего шага.
 *
 * @param step
 */
export function surveyStepGlobalMetaTitle(step: SurveyCurrentStep): string {
  return SURVEY_STEP_GLOBAL_META_TITLES[step] ?? DEFAULT_GLOBAL_META_TITLE;
}

/**
 * Подпись шага для aria-label и UI-ссылок навигации.
 *
 * @param step
 */
export function surveyStepNavLabel(step: SurveyCurrentStep): string {
  return SURVEY_STEP_NAV_LABELS[step];
}
