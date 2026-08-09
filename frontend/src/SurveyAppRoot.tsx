/**
 * Назначение: важкий UI survey — projects, persistence, AppSurveyContent (lazy chunk).
 */

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { footerUk } from './i18n/uk/footer';
import { paths } from './routing/paths';
import { useAppChrome } from './shell/useAppChrome';
import type { PendingProjectNavigation } from './utils/pendingProjectNavigation';
import { AppBootstrapSkeleton } from './components/AppBootstrapSkeleton/AppBootstrapSkeleton';
import { AccountBar } from './components/AccountBar/AccountBar';
import { DevToolsDock } from './components/DevToolsDock/DevToolsDock';
import type { HeaderProps } from './components/Header/Header';
import Logo from './components/Logo/Logo';
import type { AppSurveyContentProps } from './AppSurveyContent';
import { useSurveyDraftPersistence } from './hooks/useSurveyDraftPersistence';
import { useSurveyProject } from './hooks/useSurveyProject';
import { useDevPanelAccess } from './hooks/useDevPanelAccess';
import { brandUk } from './i18n/uk/brand';
import { buildCalcPayloadFromDraft } from './surveySession/buildCalcInputSnapshot';
import { surveyDraftToSessionSnapshot } from './surveySession/surveyDraftBridge';
import { useSurveySession } from './surveySession/useSurveySession';
import type { UseSurveyBootstrapResult } from './hooks/useSurveyBootstrap';
import type { SurveyDraft } from './types/surveyDraft';
import styles from './App.module.css';

const AppSurveyContent = lazy(() =>
  import('./AppSurveyContent').then((m) => ({ default: m.AppSurveyContent })),
);

const ProjectsDialog = lazy(() =>
  import('./components/ProjectsDialog/ProjectsDialog').then((m) => ({
    default: m.ProjectsDialog,
  })),
);

const DevPanel = lazy(() =>
  import('./components/DevPanel/DevPanel').then((m) => ({ default: m.DevPanel })),
);

export type SurveyAppRootDraftMeta = {
  clientName: string;
  projectId: string | null;
};

export type SurveyAppRootProps = Omit<AppSurveyContentProps, 'projectChrome'> & {
  draftMeta: SurveyAppRootDraftMeta;
  bootstrap: Pick<
    UseSurveyBootstrapResult,
    'resetToStart' | 'enterSurveyMode' | 'beginSurvey'
  >;
  pendingNavigation: PendingProjectNavigation | null;
  onPendingNavigationHandled: () => void;
};

/**
 * @param props
 */
export function SurveyAppRoot({
  draftMeta,
  bootstrap,
  pendingNavigation,
  onPendingNavigationHandled,
  ...surveyContentProps
}: SurveyAppRootProps) {
  const navigate = useNavigate();
  const appChrome = useAppChrome();
  const { resetToStart, enterSurveyMode, beginSurvey } = bootstrap;

  const {
    dispatch,
    draft,
    report: calcReport,
    canAutoCalc,
    setReportFromProject,
    state: sessionState,
  } = useSurveySession();

  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const [clientName, setClientName] = useState(draftMeta.clientName);
  const [projectId, setProjectId] = useState<string | null>(draftMeta.projectId);

  const applySurveyDraftState = useCallback(
    (loaded: SurveyDraft) => {
      dispatch({
        type: 'DRAFT_LOADED',
        draft: surveyDraftToSessionSnapshot(loaded),
        lastCalcReport: loaded.lastCalcReport ?? null,
      });
    },
    [dispatch],
  );

  const buildCalcPayload = useCallback(
    () => buildCalcPayloadFromDraft(draftRef.current, surveyContentProps.windowPresetsList),
    [surveyContentProps.windowPresetsList],
  );

  const getDraftParams = useCallback(
    () => ({
      currentStep: draftRef.current.currentStep,
      objectMeta: draftRef.current.objectMeta,
      rooms: draftRef.current.rooms,
      temps: draftRef.current.temps,
      hotWaterForm: draftRef.current.hotWaterForm,
      waterHeaterForm: draftRef.current.waterHeaterForm,
      waterUnderfloorHeating: draftRef.current.waterUnderfloorHeating,
      underfloorDistributionPreset: draftRef.current.underfloorDistributionPreset,
      thermalRegimePreset: draftRef.current.thermalRegimePreset,
      radiatorConnection: draftRef.current.radiatorConnection,
      radiatorEmitterPreference: draftRef.current.radiatorEmitterPreference,
      ufhPresetId: draftRef.current.ufhPresetId,
      hydraulicsForm: draftRef.current.hydraulicsForm,
      wiringLayoutV3: draftRef.current.wiringLayoutV3,
      lastCalcReport: calcReport,
    }),
    [calcReport],
  );

  const needsResetConfirm = useCallback(() => {
    if (calcReport != null) return true;
    return draftRef.current.rooms.some(
      (r) => typeof r.areaM2 === 'number' && r.areaM2 > 0,
    );
  }, [calcReport]);

  const runManualCalc = useCallback(() => {
    dispatch({ type: 'RUN_CALC_MANUAL' });
  }, [dispatch]);

  const surveyProject = useSurveyProject({
    bootstrapMode: 'survey',
    clientName,
    setClientName,
    projectId,
    setProjectId,
    getDraftParams,
    applyDraft: applySurveyDraftState,
    enterSurveyMode,
    resetToStart,
    needsResetConfirm,
    buildCalcPayload,
    canRunCalc: canAutoCalc,
    setCalcReport: setReportFromProject,
    runManualCalc,
  });

  const {
    fileInputRef,
    handleFileInputChange,
    statusMessage,
    statusError,
    projectsOpen,
    setProjectsOpen,
    projectsLoading,
    projectList,
    calculations,
    canPrintPdf,
    canPublishShare,
    canSaveProject,
    saveProjectBusy,
    shareBusy,
    shareToastOpen,
    dismissShareToast,
    saveProjectDraft,
    saveToFile,
    exportProjectBundleToFile,
    exportBusy,
    openImportFilePicker,
    importBusy,
    saveToServer,
    openFilePicker,
    exportTextFile,
    exportHashLink,
    copyPublicLink,
    revokeShare,
    printPdf,
    exitProject,
    loadProjectById,
    loadCalculationById,
    startNewProject,
    refreshProjectList,
    buildDraft,
  } = surveyProject;

  const { canShowDevPanel, showDevToolsDock } = useDevPanelAccess();

  useSurveyDraftPersistence({
    bootstrapMode: 'survey',
    calcInputKey: sessionState.calcInputKey,
    clientName,
    projectId,
    getDraftParams,
  });

  const handleNewCalculation = useCallback(() => {
    if (needsResetConfirm()) {
      const ok = window.confirm(footerUk.confirmNewCalculation);
      if (!ok) return;
    }
    beginSurvey();
  }, [needsResetConfirm, beginSurvey]);

  const handleOpenProjects = useCallback(() => {
    void navigate(paths.projects);
  }, [navigate]);

  useEffect(() => {
    appChrome.registerFooterActions({
      onNewCalculation: handleNewCalculation,
      onOpenProjects: handleOpenProjects,
    });
    return () => {
      appChrome.unregisterFooterActions();
    };
  }, [appChrome, handleNewCalculation, handleOpenProjects]);

  useEffect(() => {
    if (!pendingNavigation) return;
    if (pendingNavigation.kind === 'newProject') {
      handleNewCalculation();
      onPendingNavigationHandled();
      return;
    }
    if (pendingNavigation.kind === 'project') {
      void loadProjectById(pendingNavigation.projectId);
      onPendingNavigationHandled();
      return;
    }
    void loadCalculationById(pendingNavigation.calculationId);
    onPendingNavigationHandled();
  }, [
    pendingNavigation,
    handleNewCalculation,
    loadProjectById,
    loadCalculationById,
    onPendingNavigationHandled,
  ]);

  const headerProps: HeaderProps = {
    logo: <Logo />,
    title: brandUk.name,
    accountSlot: <AccountBar compact />,
    clientName,
    onClientNameChange: setClientName,
    projectId,
    statusMessage,
    statusError,
    canPrintPdf,
    canPublishShare,
    canSaveProject,
    saveProjectBusy,
    shareBusy,
    shareToastOpen,
    onDismissShareToast: dismissShareToast,
    onOpenProjects: handleOpenProjects,
    onSaveProject: saveProjectDraft,
    onExit: exitProject,
    onCopyPublicLink: () => {
      void copyPublicLink();
    },
    onPrintPdf: printPdf,
  };

  const sharedFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="application/json,.json"
      className={styles.hiddenInput}
      onChange={handleFileInputChange}
    />
  );

  const sharedProjectsDialog = projectsOpen ? (
    <Suspense fallback={null}>
      <ProjectsDialog
        open={projectsOpen}
        loading={projectsLoading}
        projects={projectList}
        calculations={calculations}
        activeProjectId={projectId}
        onClose={() => {
          setProjectsOpen(false);
        }}
        onRefresh={() => {
          void refreshProjectList();
        }}
        onNewProject={startNewProject}
        onSelectProject={(id) => {
          void loadProjectById(id);
        }}
        onSelectCalculation={(id) => {
          void loadCalculationById(id);
        }}
      />
    </Suspense>
  ) : null;

  const devToolsDock = showDevToolsDock ? (
    <DevToolsDock>
      {canShowDevPanel ? (
        <Suspense fallback={null}>
          <DevPanel
            projectId={projectId}
            canRunCalc={canAutoCalc}
            calcReport={calcReport}
            buildCalcPayload={buildCalcPayload}
            buildDraftJson={() => buildDraft()}
            onSaveFile={saveToFile}
            onExportProject={() => {
              void exportProjectBundleToFile();
            }}
            exportBusy={exportBusy}
            onImportProject={openImportFilePicker}
            importBusy={importBusy}
            onSaveServer={(withCalc) => {
              void saveToServer(withCalc);
            }}
            onOpenFile={openFilePicker}
            onExportText={exportTextFile}
            onExportHashLink={() => {
              void exportHashLink();
            }}
            onRunManualCalc={runManualCalc}
            onRevokeShare={() => {
              void revokeShare();
            }}
          />
        </Suspense>
      ) : null}
    </DevToolsDock>
  ) : null;

  return (
    <>
      {sharedFileInput}
      <Suspense fallback={<AppBootstrapSkeleton statusLabel="Завантаження анкети…" />}>
        <AppSurveyContent {...surveyContentProps} projectChrome={headerProps} />
      </Suspense>
      {sharedProjectsDialog}
      {devToolsDock}
    </>
  );
}
