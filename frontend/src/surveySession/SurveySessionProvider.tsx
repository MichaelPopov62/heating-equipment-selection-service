/**
 * Назначение: React-контекст единой сессии анкеты.
 * Описание: dispatch → pipeline → calc executor; uiPhase для всех секций отчёта.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { EnvelopePreset } from '../types/envelope';
import { useSurveyCalcRunner } from '../hooks/useSurveyCalcRunner';
import type { CalcReportJson } from '../types/calcApi';
import { buildCalcPayloadFromDraft, canAutoCalcFromDraft } from './buildCalcInputSnapshot';
import {
  applyCalcResponseFail,
  applyCalcResponseOk,
  endDraftInitializationPhase,
  runSurveyMutationPipeline,
} from './runSurveyMutationPipeline';
import type {
  SurveyCalcAction,
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

const SurveySessionContext = createContext<SurveySessionContextValue | null>(null);

export type SurveySessionProviderProps = {
  initialState: SurveySessionState;
  windowPresets: EnvelopePreset[];
  children: ReactNode;
};

/**
 * @param props
 */
export function SurveySessionProvider({
  initialState,
  windowPresets,
  children,
}: SurveySessionProviderProps) {
  const [session, setSession] = useState<SurveySessionState>(initialState);
  const windowPresetsRef = useRef(windowPresets);
  windowPresetsRef.current = windowPresets;

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const onCalcSuccess = useCallback((report: CalcReportJson) => {
    setSession((prev) => applyCalcResponseOk(prev, report));
  }, []);

  const onCalcError = useCallback((message: string) => {
    setSession((prev) => applyCalcResponseFail(prev, message));
  }, []);

  const buildCalcPayload = useCallback(
    () => buildCalcPayloadFromDraft(sessionRef.current.draft, windowPresetsRef.current),
    [],
  );

  const canAutoCalc = canAutoCalcFromDraft(session.draft);

  const {
    calcLoading,
    calcError: runnerError,
    beginDraftInitialization,
    endDraftInitialization,
    scheduleFreshCalc,
    runApiCalc,
    abortInFlightCalc,
  } = useSurveyCalcRunner({
    buildCalcPayload,
    canAutoCalc,
    calcInputKey: session.calcInputKey,
    onCalcSuccess,
    onCalcError,
    managedBySession: true,
    draftInitializing: session.draftInitializing,
  });

  const handleCalcAction = useCallback(
    (action: SurveyCalcAction) => {
      if (action === 'abort_only') {
        abortInFlightCalc();
        return;
      }
      if (action === 'schedule') {
        scheduleFreshCalc();
        return;
      }
      if (action === 'schedule_immediate') {
        void runApiCalc();
      }
    },
    [abortInFlightCalc, runApiCalc, scheduleFreshCalc],
  );

  const dispatch = useCallback(
    (mutation: SurveyMutation) => {
      if (mutation.type === 'DRAFT_LOADED') {
        beginDraftInitialization();
      }

      setSession((prev) => {
        const result = runSurveyMutationPipeline(prev, mutation);
        queueMicrotask(() => handleCalcAction(result.calcAction));
        return result.state;
      });

      if (mutation.type === 'DRAFT_LOADED') {
        queueMicrotask(() => {
          setSession((prev) => endDraftInitializationPhase(prev));
          endDraftInitialization();
          scheduleFreshCalc();
        });
      }
    },
    [
      beginDraftInitialization,
      endDraftInitialization,
      handleCalcAction,
      scheduleFreshCalc,
    ],
  );

  const setReportFromProject = useCallback((report: CalcReportJson | null) => {
    setSession((prev) => ({
      ...prev,
      report,
      reportEpoch: prev.reportEpoch + 1,
      uiPhase: report != null ? 'stable' : 'idle',
      calcError: null,
    }));
  }, []);

  const mergedError = session.calcError ?? runnerError;

  const value = useMemo(
    (): SurveySessionContextValue => ({
      state: session,
      dispatch,
      draft: session.draft,
      report: session.report,
      uiPhase: session.uiPhase,
      calcLoading,
      calcError: mergedError,
      canAutoCalc: canAutoCalcFromDraft(session.draft),
      runApiCalc,
      setReportFromProject,
    }),
    [dispatch, calcLoading, mergedError, runApiCalc, setReportFromProject, session],
  );

  return (
    <SurveySessionContext.Provider value={value}>
      {children}
    </SurveySessionContext.Provider>
  );
}

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
