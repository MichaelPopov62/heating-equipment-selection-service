/**
 * Назначение: Кликабельная ссылка на шаг анкеты в тексте итогов.
 * Описание: Разметка data-survey-step; обработка — делегирование в RecommendationsBlock
 * (шаг «Результат технический»).
 */

import type { ReactNode } from 'react';
import type { SurveyCurrentStep } from '../../types/surveyStep';
import { surveyStepNavLabel } from '../../constants/surveySteps';
import styles from './SurveyStepLink.module.css';

export type SurveyStepLinkProps = {
  step: SurveyCurrentStep;
  children: ReactNode;
  className?: string;
};

/**
 * @param props
 */
export function SurveyStepLink({ step, children, className }: SurveyStepLinkProps) {
  return (
    <button
      type="button"
      data-survey-step={step}
      className={[styles.stepLink, className].filter(Boolean).join(' ')}
      aria-label={`Перейти к шагу «${surveyStepNavLabel(step)}»`}
    >
      {children}
    </button>
  );
}
