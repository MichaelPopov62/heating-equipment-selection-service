/**
 * Назначение: Навигация по шагам анкеты и к секциям сайдбара «Результаты».
 * Описание: Переключение шага + прокрутка к форме; scroll к якорю итогов (ТП / ГВ / ВН).
 */

import { useCallback, useRef } from 'react';
import type { SurveyCurrentStep } from '../types/surveyStep';
import {
  RESULTS_ROOT_ID,
  type ResultsSectionId,
} from '../constants/surveyResultsSections';

type UseSurveyStepNavigationParams = {
  setCurrentStep: (step: SurveyCurrentStep) => void;
};

/**
 * @param params
 */
export function useSurveyStepNavigation({
  setCurrentStep,
}: UseSurveyStepNavigationParams) {
  const mainColumnRef = useRef<HTMLElement>(null);

  const navigateToSurveyStep = useCallback(
    (step: SurveyCurrentStep) => {
      setCurrentStep(step);
      requestAnimationFrame(() => {
        mainColumnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [setCurrentStep],
  );

  /**
   * Прокрутка к секции в сайдбаре «Результаты» (кнопка «Назад к результатам»).
   * Если секции ещё нет в DOM — к заголовку блока результатов.
   */
  const navigateToResultsSection = useCallback((sectionId: ResultsSectionId) => {
    requestAnimationFrame(() => {
      const el =
        document.getElementById(sectionId)
        ?? document.getElementById(RESULTS_ROOT_ID);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  return { mainColumnRef, navigateToSurveyStep, navigateToResultsSection };
}
