/**
 * Назначение: оркестратор bootstrap — StartAppRoot (легкий) / lazy SurveyAppRoot.
 */

import { Suspense, lazy, useCallback, useEffect, useState } from 'react';

import { AppBootstrapSkeleton } from './components/AppBootstrapSkeleton/AppBootstrapSkeleton';
import type { AppSurveyContentProps } from './AppSurveyContent';
import { useSurveyBootstrap } from './hooks/useSurveyBootstrap';
import { StartAppRoot } from './StartAppRoot';
import { useSurveySession } from './surveySession/useSurveySession';
import type { AppBootstrapMode } from './surveySession/types';
import type { SurveyDraft } from './types/surveyDraft';
import {
  consumePendingProjectNavigation,
  type PendingProjectNavigation,
} from './utils/pendingProjectNavigation';
import type { SurveyAppRootDraftMeta } from './SurveyAppRoot';

const SurveyAppRoot = lazy(() =>
  import('./SurveyAppRoot').then((m) => ({ default: m.SurveyAppRoot })),
);

type AppRootProps = Omit<AppSurveyContentProps, 'projectChrome'> & {
  onBootstrapModeChange: (mode: AppBootstrapMode) => void;
};

/**
 * @param props — справочники для SurveyAppRoot / AppSurveyContent
 */
export function AppRoot(props: AppRootProps) {
  const { onBootstrapModeChange, ...surveyContentProps } = props;
  const { dispatch } = useSurveySession();

  const [draftMeta, setDraftMeta] = useState<SurveyAppRootDraftMeta>({
    clientName: '',
    projectId: null,
  });
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingProjectNavigation | null>(null);

  const onDraftMetaLoaded = useCallback((loaded: SurveyDraft) => {
    setDraftMeta({
      clientName: loaded.clientName,
      projectId: loaded.projectId ?? null,
    });
  }, []);

  const {
    bootstrapMode,
    beginSurvey,
    resetToStart,
    enterSurveyMode,
    retryBootstrap,
  } = useSurveyBootstrap({
    dispatch,
    onDraftMetaLoaded,
  });

  useEffect(() => {
    onBootstrapModeChange(bootstrapMode);
  }, [bootstrapMode, onBootstrapModeChange]);

  useEffect(() => {
    if (bootstrapMode === 'resolving' || bootstrapMode === 'error') return;

    const pending = consumePendingProjectNavigation();
    if (!pending) return;

    if (pending.kind === 'newProject') {
      beginSurvey();
      return;
    }

    queueMicrotask(() => {
      setPendingNavigation(pending);
      enterSurveyMode();
    });
  }, [bootstrapMode, beginSurvey, enterSurveyMode]);

  const clearPendingNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  if (bootstrapMode === 'start' || bootstrapMode === 'resolving' || bootstrapMode === 'error') {
    return (
      <StartAppRoot
        bootstrapMode={bootstrapMode}
        onStartNew={beginSurvey}
        onRetryBootstrap={retryBootstrap}
      />
    );
  }

  return (
    <Suspense fallback={<AppBootstrapSkeleton statusLabel="Завантаження анкети…" />}>
      <SurveyAppRoot
        {...surveyContentProps}
        draftMeta={draftMeta}
        bootstrap={{ resetToStart, enterSurveyMode, beginSurvey }}
        pendingNavigation={pendingNavigation}
        onPendingNavigationHandled={clearPendingNavigation}
      />
    </Suspense>
  );
}
