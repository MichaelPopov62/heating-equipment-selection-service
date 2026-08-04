/**
 * Назначение: Хук управления проектами анкеты.
 * Описание: Клиент — публичная ссылка и PDF; Dev — JSON/сервер/hash.
 */

import { useCallback, useState } from 'react';

import { useProjectBundleTransfer } from './useProjectBundleTransfer';
import { useProjectMutations } from '../query/mutations/useProjectMutations';
import { useProjectCalculationsQuery } from '../query/queries/useProjectCalculationsQuery';
import { useProjectsListQuery } from '../query/queries/useProjectsListQuery';
import {
  publishProjectShare,
  revokeProjectShare,
  downloadProjectPdf,
} from '../services/projectsApi';
import { saveSurveyDraftToStorage } from '../services/surveyDraftStorage';
import type { AppBootstrapMode } from '../surveySession/types';
import type { CalcReportJson } from '../types/calcApi';
import type { SurveyDraft } from '../types/surveyDraft';
import { downloadJsonFile, downloadTextFile } from '../utils/fileDownload';
import { parseCommercialBomFromReport } from '../utils/parseCommercialBomFromReport';
import { buildPublicShareUrlFromToken } from '../utils/parseSharePath';
import { buildSurveyDraft } from '../utils/buildSurveyDraft';
import {
  buildSurveyTextSummary,
  copyTextToClipboard,
  encodeSurveyDraftToUrl,
} from '../utils/surveyShare';

export type UseSurveyProjectParams = {
  bootstrapMode: AppBootstrapMode;
  clientName: string;
  setClientName: (value: string) => void;
  projectId: string | null;
  setProjectId: (value: string | null) => void;
  /** Поля анкеты без clientName/projectId (их хранит хук). */
  getDraftParams: () => Omit<
    Parameters<typeof buildSurveyDraft>[0],
    'savedAt' | 'schemaVersion' | 'clientName' | 'projectId'
  >;
  applyDraft: (draft: SurveyDraft) => void;
  enterSurveyMode: () => void;
  resetToStart: () => void;
  needsResetConfirm: () => boolean;
  buildCalcPayload: () => unknown;
  canRunCalc: boolean;
  setCalcReport: (report: CalcReportJson | null) => void;
  runManualCalc: () => void;
};

/**
 * @param params
 */
export function useSurveyProject({
  bootstrapMode,
  clientName,
  setClientName,
  projectId,
  setProjectId,
  getDraftParams,
  applyDraft,
  enterSurveyMode,
  resetToStart,
  needsResetConfirm,
  buildCalcPayload,
  canRunCalc,
  setCalcReport,
  runManualCalc,
}: UseSurveyProjectParams) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [publicPath, setPublicPath] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareToastOpen, setShareToastOpen] = useState(false);

  const {
    saveProjectMutation,
    loadProjectMutation,
    loadCalculationMutation,
  } = useProjectMutations();

  const saveProjectBusy = saveProjectMutation.isPending;

  const {
    projectList,
    projectsLoading,
    refetch: refetchProjects,
  } = useProjectsListQuery({ enabled: projectsOpen });

  const { calculations, refetch: refetchCalculations } = useProjectCalculationsQuery({
    projectId,
    enabled: projectsOpen && projectId != null,
  });

  const buildDraft = useCallback((): SurveyDraft => {
    const p = getDraftParams();
    return buildSurveyDraft({
      ...p,
      clientName,
      projectId,
    });
  }, [getDraftParams, clientName, projectId]);

  const showOk = useCallback((msg: string) => {
    setStatusError(null);
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  }, []);

  const showErr = useCallback((msg: string) => {
    setStatusMessage(null);
    setStatusError(msg);
  }, []);

  const applyDraftAndMeta = useCallback(
    (draft: SurveyDraft) => {
      applyDraft(draft);
      setClientName(draft.clientName);
      setProjectId(draft.projectId ?? null);
      saveSurveyDraftToStorage(draft);
      enterSurveyMode();
    },
    [applyDraft, enterSurveyMode, setClientName, setProjectId],
  );

  const {
    fileInputRef,
    handleFileInputChange,
    requestImport: openImportFilePicker,
    requestOpenLocal: openFilePicker,
    sendProjectBundle,
    importBusy,
    exportBusy,
  } = useProjectBundleTransfer({
    confirmBeforeImport: () => {
      if (!needsResetConfirm()) return true;
      return window.confirm(
        'Поточна анкета буде замінена імпортованим проєктом. Продовжити?',
      );
    },
    onImportSuccess: (result) => {
      applyDraft(result.draft);
      setClientName(result.draft.clientName);
      setProjectId(result.project.id);
      saveSurveyDraftToStorage(result.draft);
      enterSurveyMode();
      if (result.latestReport) {
        setCalcReport(result.latestReport);
      }
      setPublicPath(null);
      setShareToastOpen(false);
    },
    onOpenLocalSuccess: (draft) => {
      applyDraftAndMeta(draft);
    },
    onStatus: (message, error) => {
      if (error) showErr(error);
      else if (message) showOk(message);
    },
  });

  const saveToFile = useCallback(() => {
    if (bootstrapMode !== 'survey') return;
    try {
      const draft = buildDraft();
      const safe = draft.clientName
        .replace(/[^\p{L}\p{N}\-_]+/gu, '_')
        .slice(0, 40);
      const date = draft.savedAt.slice(0, 10);
      downloadJsonFile(`heatcalc-${safe}-${date}.json`, draft);
      showOk('Файл JSON збережено (Dev)');
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Не вдалося зберегти файл');
    }
  }, [bootstrapMode, buildDraft, showOk, showErr]);

  const exportProjectBundleToFile = useCallback(async () => {
    if (bootstrapMode !== 'survey') return;

    const localDraft = buildDraft();
    let localLastCalcInput: unknown;
    if (canRunCalc) {
      try {
        localLastCalcInput = buildCalcPayload();
      } catch {
        /* calcInput опционален для экспорта */
      }
    }

    await sendProjectBundle({
      projectId,
      clientName: localDraft.clientName,
      localDraft,
      localLastCalcInput,
    });
  }, [
    bootstrapMode,
    buildDraft,
    buildCalcPayload,
    canRunCalc,
    projectId,
    sendProjectBundle,
  ]);

  const saveToServer = useCallback(
    async (withCalc: boolean) => {
      if (bootstrapMode !== 'survey') return;
      try {
        const draft = buildDraft();
        const result = await saveProjectMutation.mutateAsync({
          projectId,
          clientName,
          draft,
          withCalc,
          canRunCalc,
          buildCalcPayload,
        });
        setProjectId(result.projectId);
        if (result.report) {
          setCalcReport(result.report);
        }
        if (withCalc && result.report) {
          showOk('Проєкт і розрахунок збережено на сервері');
        } else if (withCalc && !canRunCalc) {
          showOk('Проєкт збережено (розрахунок пропущено — неповна анкета)');
        } else {
          showOk('Проєкт збережено на сервері');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Помилка збереження';
        if (msg.includes('MONGODB_UNAVAILABLE') || msg.includes('503')) {
          showErr('MongoDB недоступна — збережіть JSON-файл (Dev)');
        } else {
          showErr(msg);
        }
      }
    },
    [
      bootstrapMode,
      buildDraft,
      buildCalcPayload,
      canRunCalc,
      clientName,
      projectId,
      saveProjectMutation,
      setCalcReport,
      setProjectId,
      showOk,
      showErr,
    ],
  );

  const exportTextFile = useCallback(() => {
    if (bootstrapMode !== 'survey') return;
    try {
      const draft = buildDraft();
      const report = getDraftParams().lastCalcReport ?? null;
      const text = buildSurveyTextSummary(draft, report);
      const safe = draft.clientName
        .replace(/[^\p{L}\p{N}\-_]+/gu, '_')
        .slice(0, 40);
      downloadTextFile(`heatcalc-${safe}-summary.txt`, text);
      showOk('Текстову зведенку завантажено (Dev)');
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Помилка експорту');
    }
  }, [bootstrapMode, buildDraft, getDraftParams, showOk, showErr]);

  const exportHashLink = useCallback(async () => {
    if (bootstrapMode !== 'survey') return;
    try {
      const draft = buildDraft();
      const url = encodeSurveyDraftToUrl(draft);
      await copyTextToClipboard(url);
      showOk('Hash-посилання чернетки скопійовано (Dev, без звіту)');
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Не вдалося створити посилання');
    }
  }, [bootstrapMode, buildDraft, showOk, showErr]);

  const ensureProjectSaved = useCallback(async (): Promise<string> => {
    const draft = buildDraft();
    const result = await saveProjectMutation.mutateAsync({
      projectId,
      clientName,
      draft,
      withCalc: canRunCalc,
      canRunCalc,
      buildCalcPayload,
    });
    setProjectId(result.projectId);
    if (result.report) {
      setCalcReport(result.report);
    }
    if (canRunCalc && !result.report) {
      throw new Error('Не вдалося зберегти розрахунок на сервер');
    }
    return result.projectId;
  }, [
    buildDraft,
    buildCalcPayload,
    canRunCalc,
    clientName,
    projectId,
    saveProjectMutation,
    setCalcReport,
    setProjectId,
  ]);

  const dismissShareToast = useCallback(() => {
    setShareToastOpen(false);
  }, []);

  const copyPublicLink = useCallback(async () => {
    if (bootstrapMode !== 'survey') return;
    setShareBusy(true);
    setShareToastOpen(false);
    try {
      if (!clientName.trim()) {
        throw new Error('Вкажіть ім\'я клієнта перед публікацією посилання');
      }
      const report = getDraftParams().lastCalcReport;
      if (!report || !parseCommercialBomFromReport(report)) {
        throw new Error('Немає фінансового підсумку — дочекайтеся розрахунку');
      }

      const id = await ensureProjectSaved();
      const published = await publishProjectShare(id);
      setPublicPath(published.publicPath);
      const shareUrl = buildPublicShareUrlFromToken(published.shareToken);
      await copyTextToClipboard(shareUrl);
      setShareToastOpen(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не вдалося опублікувати посилання';
      if (msg.includes('MONGODB_UNAVAILABLE') || msg.includes('503')) {
        showErr('MongoDB недоступна — публікація посилання неможлива');
      } else if (msg.includes('Буфер обміну')) {
        showErr('Буфер обміну недоступний — скопіюйте посилання вручну з Dev');
      } else {
        showErr(msg);
      }
    } finally {
      setShareBusy(false);
    }
  }, [
    bootstrapMode,
    clientName,
    ensureProjectSaved,
    getDraftParams,
    showErr,
  ]);

  const revokeShare = useCallback(async () => {
    if (!projectId) {
      showErr('Немає projectId');
      return;
    }
    try {
      await revokeProjectShare(projectId);
      setPublicPath(null);
      showOk('Публічне посилання відкликано (Dev)');
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Не вдалося відкликати посилання');
    }
  }, [projectId, showOk, showErr]);

  const printPdf = useCallback(
    (includeTechnical: boolean) => {
      if (bootstrapMode !== 'survey') return;
      void (async () => {
        try {
          const report = getDraftParams().lastCalcReport;
          if (!report || !parseCommercialBomFromReport(report)) {
            throw new Error('Немає фінансового підсумку — дочекайтеся розрахунку');
          }
          if (!canRunCalc) {
            throw new Error('Анкета неповна — розрахунок на сервер не зберегти');
          }
          const id = await ensureProjectSaved();
          await downloadProjectPdf(id, { includeTechnical });
          showOk('PDF завантажено');
        } catch (e) {
          showErr(e instanceof Error ? e.message : 'Не вдалося завантажити PDF');
        }
      })();
    },
    [
      bootstrapMode,
      canRunCalc,
      ensureProjectSaved,
      getDraftParams,
      showOk,
      showErr,
    ],
  );

  const refreshProjectList = useCallback(async () => {
    try {
      await refetchProjects();
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Не вдалося завантажити проєкти');
    }
  }, [refetchProjects, showErr]);

  const openProjectsPanel = useCallback(() => {
    setProjectsOpen(true);
    void refreshProjectList();
  }, [refreshProjectList]);

  const loadProjectById = useCallback(
    async (id: string) => {
      try {
        const result = await loadProjectMutation.mutateAsync({ projectId: id });
        if (result.draft) {
          applyDraftAndMeta(result.draft);
        } else {
          setClientName(result.clientName);
          setProjectId(result.projectId);
          enterSurveyMode();
        }
        if (result.report) {
          setCalcReport(result.report);
        }
        setPublicPath(null);
        setShareToastOpen(false);
        setProjectsOpen(false);
        showOk(`Завантажено проєкт: ${result.clientName}`);
        void refetchCalculations();
      } catch (e) {
        showErr(e instanceof Error ? e.message : 'Не вдалося відкрити проєкт');
      }
    },
    [
      applyDraftAndMeta,
      enterSurveyMode,
      loadProjectMutation,
      refetchCalculations,
      setCalcReport,
      setClientName,
      setProjectId,
      showOk,
      showErr,
    ],
  );

  const loadCalculationById = useCallback(
    async (calcId: string) => {
      if (!projectId) return;
      try {
        const report = await loadCalculationMutation.mutateAsync({
          projectId,
          calculationId: calcId,
        });
        setCalcReport(report);
        showOk('Завантажено збережений розрахунок');
      } catch (e) {
        showErr(e instanceof Error ? e.message : 'Не вдалося завантажити розрахунок');
      }
    },
    [projectId, loadCalculationMutation, setCalcReport, showOk, showErr],
  );

  const exitToStart = useCallback(() => {
    resetToStart();
    setStatusMessage(null);
    setStatusError(null);
    setClientName('');
    setProjectId(null);
    setPublicPath(null);
    setShareToastOpen(false);
    setProjectsOpen(false);
  }, [resetToStart, setClientName, setProjectId]);

  /** Выход на Start Screen: без confirm, если проект уже на сервере. */
  const exitProject = useCallback(() => {
    if (!projectId && needsResetConfirm()) {
      const ok = window.confirm(
        'Вийти з проєкту? Незбережені дані поточної анкети будуть скинуті.',
      );
      if (!ok) return;
    }
    exitToStart();
  }, [exitToStart, needsResetConfirm, projectId]);

  const startNewProject = useCallback(() => {
    if (needsResetConfirm()) {
      const ok = window.confirm(
        'Почати новий проєкт? Незбережені дані поточної анкети будуть скинуті.',
      );
      if (!ok) return;
    }
    exitToStart();
  }, [needsResetConfirm, exitToStart]);

  const report = getDraftParams().lastCalcReport ?? null;
  const hasFinancialReport = parseCommercialBomFromReport(report) != null;
  const canPrintPdf = hasFinancialReport && canRunCalc;
  const canPublishShare = Boolean(clientName.trim()) && canPrintPdf;
  const canSaveProject = Boolean(clientName.trim());

  const saveProjectDraft = useCallback(() => {
    void saveToServer(canRunCalc);
  }, [saveToServer, canRunCalc]);

  return {
    statusMessage,
    statusError,
    fileInputRef,
    handleFileInputChange,
    projectsOpen,
    setProjectsOpen,
    projectsLoading,
    projectList,
    calculations,
    publicPath,
    shareBusy,
    shareToastOpen,
    dismissShareToast,
    canPrintPdf,
    canPublishShare,
    canSaveProject,
    saveProjectBusy,
    exportBusy,
    importBusy,
    saveToFile,
    exportProjectBundleToFile,
    saveToServer,
    saveProjectDraft,
    openFilePicker,
    openImportFilePicker,
    exportTextFile,
    exportHashLink,
    copyPublicLink,
    revokeShare,
    printPdf,
    exitProject,
    openProjectsPanel,
    loadProjectById,
    loadCalculationById,
    startNewProject,
    refreshProjectList,
    buildDraft,
    runManualCalc,
  };
}
