/**
 * Назначение: React-контекст единой сессии анкеты (типы и createContext).
 */

import { createContext } from 'react';

import type { CalcReportJson } from '../types/calcApi';
import type {
  SurveyDraftSnapshot,
  SurveyMutation,
  SurveySessionState,
  SurveyUiPhase,
} from './types';

export type SurveySessionContextValue = {
  state: SurveySessionState;
  dispatch: (mutation: SurveyMutation) => void;
  draft: SurveyDraftSnapshot;
  report: CalcReportJson | null;
  uiPhase: SurveyUiPhase;
  calcLoading: boolean;
  calcError: string | null;
  canAutoCalc: boolean;
  runApiCalc: () => Promise<void>;
  setReportFromProject: (report: CalcReportJson | null) => void;
};

export const SurveySessionContext = createContext<SurveySessionContextValue | null>(null);
