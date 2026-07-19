/**
 * Назначение: Навигация по шагам анкеты и к секциям «Результат технический».
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
 * После смены шага ждём два кадра отрисовки, чтобы якоря technicalResult были в DOM.
 *
 * @param fn
 */
function afterNextPaint(fn: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
}

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
      afterNextPaint(() => {
        mainColumnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [setCurrentStep],
  );

  /**
   * Переход на шаг «Результат технический» и прокрутка к секции
   * (кнопка «Назад к результатам»). Если секции ещё нет — к заголовку блока.
   *
   * @param sectionId
   */
  const navigateToResultsSection = useCallback((sectionId: ResultsSectionId) => {
    setCurrentStep('technicalResult');
    afterNextPaint(() => {
      const el =
        document.getElementById(sectionId)
        ?? document.getElementById(RESULTS_ROOT_ID);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [setCurrentStep]);

  return { mainColumnRef, navigateToSurveyStep, navigateToResultsSection };
}
