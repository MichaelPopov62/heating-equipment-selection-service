/**
 * Назначение: порядок шагов анкеты (UI-навигация и валидация черновика).
 * Описание: SSOT для боковой навигации, migrateSurveyDraft и isSurveyStep.
 * Порядок: object → warmFloor → rooms → hotWater → boiler → radiators →
 * waterHeater → hydraulics → technicalResult → dataReference → financialResult
 * (ТП до помещений: флаг / ufhPresetId).
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
  technicalResult: 'Результат технический',
  dataReference: 'Справочник данных',
  financialResult: 'Итог финансовый',
};

/** Заголовок блока globalMeta; для шагов без записи — «Параметры объекта». */
const SURVEY_STEP_GLOBAL_META_TITLES: Partial<Record<SurveyCurrentStep, string>> = {
  rooms: 'Параметры помещений',
  hotWater: 'Объект и горячая вода',
  boiler: 'Котёл: температурный график отопления',
  radiators: 'Радиаторы: подводка и тип приборов',
  waterHeater: 'Водонагреватель и сценарий ГВС',
  warmFloor: 'Тёплый пол и низкотемпературный контур',
  hydraulics: 'Гидравлика и разводка',
  technicalResult: 'Технический результат расчёта',
  dataReference: 'Справочник оборудования каталога',
  financialResult: 'Итог финансовый по расчёту',
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
  'technicalResult',
  'dataReference',
  'financialResult',
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
