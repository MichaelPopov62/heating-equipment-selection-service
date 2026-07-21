/**
 * Назначение: Bootstrap приложения — resolving / start / survey.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

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

const RESOLVING_MIN_MS = 200;
const RESOLVING_TIMEOUT_MS = 3000;

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
  const [bootstrapMode, setBootstrapMode] = useState<AppBootstrapMode>('resolving');
  const onDraftMetaLoadedRef = useRef(onDraftMetaLoaded);
  const mountedRef = useRef(false);

  useEffect(() => {
    onDraftMetaLoadedRef.current = onDraftMetaLoaded;
  }, [onDraftMetaLoaded]);

  const resolveOnce = useCallback(() => {
    const startedAt = Date.now();

    const finish = (mode: AppBootstrapMode) => {
      const elapsed = Date.now() - startedAt;
      const delay = Math.max(0, RESOLVING_MIN_MS - elapsed);
      window.setTimeout(() => {
        setBootstrapMode(mode);
      }, delay);
    };

    let finished = false;
    const timeoutId = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      setBootstrapMode('error');
    }, RESOLVING_TIMEOUT_MS);

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

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    queueMicrotask(() => {
      resolveOnce();
    });
  }, [resolveOnce]);

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
    mountedRef.current = false;
    setBootstrapMode('resolving');
    queueMicrotask(() => {
      mountedRef.current = true;
      resolveOnce();
    });
  }, [resolveOnce]);

  return {
    bootstrapMode,
    beginSurvey,
    resetToStart,
    enterSurveyMode,
    retryBootstrap,
  };
}
