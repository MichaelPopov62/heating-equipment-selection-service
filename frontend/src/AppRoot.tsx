/**
 * Назначение: Корень UI после SurveySessionProvider — bootstrap и режимы start/survey.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { brandUk } from './i18n/uk/brand';
import { footerUk } from './i18n/uk/footer';
import { paths } from './routing/paths';
import { useAppChrome } from './shell/useAppChrome';
import { consumePendingProjectNavigation } from './utils/pendingProjectNavigation';

import { AppBootstrapSkeleton } from './components/AppBootstrapSkeleton/AppBootstrapSkeleton';
import { BootstrapErrorScreen } from './components/BootstrapErrorScreen/BootstrapErrorScreen';
import { DevPanel } from './components/DevPanel/DevPanel';
import { Header } from './components/Header/Header';
import type { HeaderProps } from './components/Header/Header';
import Logo from './components/Logo/Logo';
import { ProjectsDialog } from './components/ProjectsDialog/ProjectsDialog';
import { StartScreen } from './components/StartScreen/StartScreen';
import styles from './App.module.css';
import { AppSurveyContent } from './AppSurveyContent';
import type { AppSurveyContentProps } from './AppSurveyContent';
import { useSurveyBootstrap } from './hooks/useSurveyBootstrap';
import { useSurveyDraftPersistence } from './hooks/useSurveyDraftPersistence';
import { useSurveyProject } from './hooks/useSurveyProject';
import { buildCalcPayloadFromDraft } from './surveySession/buildCalcInputSnapshot';
import { surveyDraftToSessionSnapshot } from './surveySession/surveyDraftBridge';
import { useSurveySession } from './surveySession/useSurveySession';
import type { AppBootstrapMode } from './surveySession/types';
import type { SurveyDraft } from './types/surveyDraft';
import { isDevToolsEnabled } from './utils/isDevToolsEnabled';

type AppRootProps = Omit<AppSurveyContentProps, 'projectChrome'> & {
  onBootstrapModeChange: (mode: AppBootstrapMode) => void;
};

/**
 * @param props — справочники для AppSurveyContent
 */
export function AppRoot(props: AppRootProps) {
  const navigate = useNavigate();
  const appChrome = useAppChrome();
  const {
    onBootstrapModeChange,
    ...surveyContentProps
  } = props;
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

  const [clientName, setClientName] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);

  const onDraftMetaLoaded = useCallback((loaded: SurveyDraft) => {
    setClientName(loaded.clientName);
    setProjectId(loaded.projectId ?? null);
  }, []);

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
    bootstrapMode,
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
    saveToServer,
    openFilePicker,
    handleFileSelected,
    exportTextFile,
    exportHashLink,
    copyPublicLink,
    revokeShare,
    printPdf,
    exitProject,
    openProjectsPanel: _openProjectsPanel,
    loadProjectById,
    loadCalculationById,
    startNewProject,
    refreshProjectList,
    buildDraft,
  } = surveyProject;

  useEffect(() => {
    onBootstrapModeChange(bootstrapMode);
  }, [bootstrapMode, onBootstrapModeChange]);

  useSurveyDraftPersistence({
    bootstrapMode,
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
    if (bootstrapMode === 'resolving') return;
    const pending = consumePendingProjectNavigation();
    if (!pending) return;
    if (pending.kind === 'newProject') {
      handleNewCalculation();
      return;
    }
    if (pending.kind === 'project') {
      void loadProjectById(pending.projectId);
      return;
    }
    void loadCalculationById(pending.calculationId);
  }, [bootstrapMode, handleNewCalculation, loadProjectById, loadCalculationById]);

  const headerProps: HeaderProps = {
    logo: <Logo />,
    title: brandUk.name,
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
      style={{ display: 'none' }}
      onChange={(e) => {
        void handleFileSelected(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  const sharedProjectsDialog = (
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
  );

  const devPanel = isDevToolsEnabled() ? (
    <DevPanel
      projectId={projectId}
      canRunCalc={canAutoCalc}
      calcReport={calcReport}
      buildCalcPayload={buildCalcPayload}
      buildDraftJson={() => buildDraft()}
      onSaveFile={saveToFile}
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
  ) : null;

  if (bootstrapMode === 'resolving') {
    return (
      <>
        {sharedFileInput}
        <AppBootstrapSkeleton />
        {sharedProjectsDialog}
        {devPanel}
      </>
    );
  }

  if (bootstrapMode === 'error') {
    return (
      <>
        {sharedFileInput}
        <BootstrapErrorScreen onRetry={retryBootstrap} />
        {sharedProjectsDialog}
        {devPanel}
      </>
    );
  }

  if (bootstrapMode === 'start') {
    return (
      <div className={styles.appContainer}>
        {sharedFileInput}
        <Header {...headerProps} variant="start" />
        <StartScreen onStartNew={handleNewCalculation} />
        {sharedProjectsDialog}
        {devPanel}
      </div>
    );
  }

  return (
    <>
      {sharedFileInput}
      <AppSurveyContent {...surveyContentProps} projectChrome={headerProps} />
      {sharedProjectsDialog}
      {devPanel}
    </>
  );
}
