/**
 * Назначение: хук доступа к контексту сессии анкеты.
 */

import { useContext } from 'react';

import {
  SurveySessionContext,
  type SurveySessionContextValue,
} from './surveySessionContext';

/**
 * @returns {SurveySessionContextValue}
 */
export function useSurveySession(): SurveySessionContextValue {
  const ctx = useContext(SurveySessionContext);
  if (ctx == null) {
    throw new Error('useSurveySession: вне SurveySessionProvider');
  }
  return ctx;
}
