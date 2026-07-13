/**
 * Назначение: React-контекст единой сессии анкеты.
 * Описание: dispatch → pipeline → calc executor; uiPhase для всех секций отчёта.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { EnvelopePreset } from '../types/envelope';
import { useSurveyCalc } from '../query/useSurveyCalc';
import type { CalcReportJson } from '../types/calcApi';
import { buildCalcPayloadFromDraft, canAutoCalcFromDraft } from './buildCalcInputSnapshot';
import {
  applyCalcResponseFail,
  applyCalcResponseOk,
  applyCalcSkippedDedup,
  endDraftInitializationPhase,
  runSurveyMutationPipeline,
} from './runSurveyMutationPipeline';
import {
  SurveySessionContext,
  type SurveySessionContextValue,
} from './surveySessionContext';
import type {
  SurveyCalcAction,
  SurveyMutation,
  SurveySessionState,
} from './types';

export type { SurveySessionContextValue } from './surveySessionContext';

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
  const sessionRef = useRef(session);

  useEffect(() => {
    windowPresetsRef.current = windowPresets;
  }, [windowPresets]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const onCalcSuccess = useCallback((report: CalcReportJson) => {
    setSession((prev) => applyCalcResponseOk(prev, report));
  }, []);

  const onCalcError = useCallback((message: string) => {
    setSession((prev) => applyCalcResponseFail(prev, message));
  }, []);

  const onCalcSkippedDedup = useCallback(() => {
    setSession((prev) => applyCalcSkippedDedup(prev));
  }, []);

  const buildCalcPayload = useCallback(
    () => buildCalcPayloadFromDraft(sessionRef.current.draft, windowPresetsRef.current),
    [],
  );

  const canAutoCalc = canAutoCalcFromDraft(session.draft);

  const {
    calcLoading,
    calcError: runnerError,
    scheduleFreshCalc,
    runApiCalc,
    abortInFlightCalc,
  } = useSurveyCalc({
    buildCalcPayload,
    canAutoCalc,
    calcInputKey: session.calcInputKey,
    onCalcSuccess,
    onCalcError,
    onCalcSkippedDedup,
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
      setSession((prev) => {
        const result = runSurveyMutationPipeline(prev, mutation);
        queueMicrotask(() => handleCalcAction(result.calcAction));
        return result.state;
      });

      if (mutation.type === 'DRAFT_LOADED') {
        queueMicrotask(() => {
          setSession((prev) => endDraftInitializationPhase(prev));
          scheduleFreshCalc();
        });
      }
    },
    [handleCalcAction, scheduleFreshCalc],
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
