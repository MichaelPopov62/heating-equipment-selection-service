/**
 * Назначение: Bootstrap приложения — resolving / start / survey.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  clearSurveyDraftStorage,
  loadSurveyDraftFromStorage,
} from '../services/surveyDraftStorage';
import {
  clearSurveyHashFromUrl,
  resolveAppBootstrap,
} from '../surveySession/resolveAppBootstrap';
import { surveyDraftToSessionSnapshot } from '../surveySession/surveyDraftBridge';
import type { AppBootstrapMode, SurveyMutation } from '../surveySession/types';
import type { SurveyDraft } from '../types/surveyDraft';

const RESOLVING_TIMEOUT_MS = 3000;

type SurveyBootstrapResolved = Extract<
  ReturnType<typeof resolveAppBootstrap>,
  { mode: 'survey' }
>;

type InitialBootstrapSnapshot = {
  mode: AppBootstrapMode;
  surveyResolved: SurveyBootstrapResolved | null;
};

/**
 * Синхронный cold-open resolve — без фазы resolving/skeleton (LCP/CLS).
 *
 * @returns {InitialBootstrapSnapshot}
 */
function resolveInitialBootstrapSnapshot(): InitialBootstrapSnapshot {
  try {
    const storageDraft = loadSurveyDraftFromStorage();
    const resolved = resolveAppBootstrap(window.location.hash, storageDraft);
    if (resolved.mode === 'survey') {
      return { mode: 'survey', surveyResolved: resolved };
    }
    return { mode: 'start', surveyResolved: null };
  } catch {
    return { mode: 'error', surveyResolved: null };
  }
}

export type UseSurveyBootstrapParams = {
  dispatch: (mutation: SurveyMutation) => void;
  onDraftMetaLoaded: (draft: SurveyDraft) => void;
};

export type UseSurveyBootstrapResult = {
  bootstrapMode: AppBootstrapMode;
  beginSurvey: () => void;
  resetToStart: () => void;
  enterSurveyMode: () => void;
  retryBootstrap: () => void;
};

/**
 * @param params
 * @returns {UseSurveyBootstrapResult}
 */
export function useSurveyBootstrap({
  dispatch,
  onDraftMetaLoaded,
}: UseSurveyBootstrapParams): UseSurveyBootstrapResult {
  const [initialBootstrap] = useState(() => resolveInitialBootstrapSnapshot());
  const [bootstrapMode, setBootstrapMode] = useState<AppBootstrapMode>(initialBootstrap.mode);
  const onDraftMetaLoadedRef = useRef(onDraftMetaLoaded);
  const bootstrapDispatchAppliedRef = useRef(false);

  useEffect(() => {
    onDraftMetaLoadedRef.current = onDraftMetaLoaded;
  }, [onDraftMetaLoaded]);

  useLayoutEffect(() => {
    if (bootstrapDispatchAppliedRef.current) return;
    bootstrapDispatchAppliedRef.current = true;

    if (initialBootstrap.mode === 'survey' && initialBootstrap.surveyResolved) {
      dispatch({
        type: 'DRAFT_LOADED',
        draft: surveyDraftToSessionSnapshot(initialBootstrap.surveyResolved.draft),
        lastCalcReport: initialBootstrap.surveyResolved.draft.lastCalcReport ?? null,
      });
      onDraftMetaLoadedRef.current(initialBootstrap.surveyResolved.draft);
      if (initialBootstrap.surveyResolved.source === 'hash') {
        clearSurveyHashFromUrl();
      }
      return;
    }

    if (initialBootstrap.mode === 'start') {
      dispatch({ type: 'SESSION_RESET' });
    }
  }, [dispatch, initialBootstrap]);

  const resolveOnce = useCallback(() => {
    let finished = false;
    const timeoutId = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      setBootstrapMode('error');
    }, RESOLVING_TIMEOUT_MS);

    /**
     * @param mode — целевой режим приложения
     */
    const finish = (mode: AppBootstrapMode) => {
      setBootstrapMode(mode);
    };

    try {
      const storageDraft = loadSurveyDraftFromStorage();
      const resolved = resolveAppBootstrap(window.location.hash, storageDraft);

      if (resolved.mode === 'survey') {
        dispatch({
          type: 'DRAFT_LOADED',
          draft: surveyDraftToSessionSnapshot(resolved.draft),
          lastCalcReport: resolved.draft.lastCalcReport ?? null,
        });
        onDraftMetaLoadedRef.current(resolved.draft);
        if (resolved.source === 'hash') {
          clearSurveyHashFromUrl();
        }
        finished = true;
        window.clearTimeout(timeoutId);
        finish('survey');
        return;
      }

      dispatch({ type: 'SESSION_RESET' });
      finished = true;
      window.clearTimeout(timeoutId);
      finish('start');
    } catch {
      finished = true;
      window.clearTimeout(timeoutId);
      setBootstrapMode('error');
    }
  }, [dispatch]);

  const beginSurvey = useCallback(() => {
    dispatch({ type: 'SURVEY_STARTED' });
    setBootstrapMode('survey');
  }, [dispatch]);

  const resetToStart = useCallback(() => {
    dispatch({ type: 'SESSION_RESET' });
    clearSurveyDraftStorage();
    setBootstrapMode('start');
  }, [dispatch]);

  const enterSurveyMode = useCallback(() => {
    setBootstrapMode('survey');
  }, []);

  const retryBootstrap = useCallback(() => {
    setBootstrapMode('resolving');
    resolveOnce();
  }, [resolveOnce]);

  return {
    bootstrapMode,
    beginSurvey,
    resetToStart,
    enterSurveyMode,
    retryBootstrap,
  };
}
