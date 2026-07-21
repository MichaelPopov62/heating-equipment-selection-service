/**
 * Назначение: Debounced persist черновика в localStorage.
 */

import { useEffect, useRef } from 'react';

import type { AppBootstrapMode } from '../surveySession/types';
import { buildSurveyDraft } from '../utils/buildSurveyDraft';
import {
  isPersistableSurveyDraft,
  saveSurveyDraftToStorage,
} from '../services/surveyDraftStorage';

const PERSIST_DEBOUNCE_MS = 400;

export type UseSurveyDraftPersistenceParams = {
  bootstrapMode: AppBootstrapMode;
  calcInputKey: string;
  clientName: string;
  projectId: string | null;
  getDraftParams: () => Omit<
    Parameters<typeof buildSurveyDraft>[0],
    'savedAt' | 'schemaVersion' | 'clientName' | 'projectId'
  >;
};

/**
 * @param params
 */
export function useSurveyDraftPersistence(params: UseSurveyDraftPersistenceParams): void {
  const {
    bootstrapMode,
    calcInputKey,
    clientName,
    projectId,
    getDraftParams,
  } = params;

  const getDraftParamsRef = useRef(getDraftParams);

  useEffect(() => {
    getDraftParamsRef.current = getDraftParams;
  }, [getDraftParams]);

  useEffect(() => {
    if (bootstrapMode !== 'survey') return;

    const timer = window.setTimeout(() => {
      const draft = buildSurveyDraft({
        ...getDraftParamsRef.current(),
        clientName,
        projectId,
      });
      if (!isPersistableSurveyDraft(draft)) return;
      saveSurveyDraftToStorage(draft);
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [bootstrapMode, calcInputKey, clientName, projectId]);
}
