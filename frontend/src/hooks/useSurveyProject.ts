/**
 * Назначение: Хук управления проектами анкеты.
 * Описание: Клиент — публичная ссылка и PDF; Dev — JSON/сервер/hash.
 */

import { useCallback, useRef, useState } from 'react';

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
import { buildSurveyDraft } from '../utils/buildSurveyDraft';
import { downloadJsonFile, downloadTextFile } from '../utils/fileDownload';
import { parseCommercialBomFromReport } from '../utils/parseCommercialBomFromReport';
import { buildPublicShareUrlFromToken } from '../utils/parseSharePath';
import { parseSurveyDraft } from '../utils/parseSurveyDraft';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    saveProjectMutation,
    loadProjectMutation,
    loadCalculationMutation,
  } = useProjectMutations();

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

  const saveToFile = useCallback(() => {
    if (bootstrapMode !== 'survey') return;
    try {
      const draft = buildDraft();
      const safe = draft.clientName
        .replace(/[^\p{L}\p{N}\-_]+/gu, '_')
        .slice(0, 40);
      const date = draft.savedAt.slice(0, 10);
      downloadJsonFile(`heatcalc-${safe}-${date}.json`, draft);
      showOk('Файл JSON сохранён (Dev)');
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Не удалось сохранить файл');
    }
  }, [bootstrapMode, buildDraft, showOk, showErr]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        const text = await file.text();
        const raw: unknown = JSON.parse(text);
        const draft = parseSurveyDraft(raw);
        applyDraftAndMeta(draft);
        showOk(`Загружено из файла: ${file.name}`);
      } catch (e) {
        showErr(e instanceof Error ? e.message : 'Не удалось прочитать файл');
      }
    },
    [applyDraftAndMeta, showOk, showErr],
  );

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
          showOk('Проект и расчёт сохранены на сервере (Dev)');
        } else if (withCalc && !canRunCalc) {
          showOk('Проект сохранён (расчёт пропущен: неполная анкета)');
        } else {
          showOk('Проект сохранён на сервере (Dev)');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ошибка сохранения';
        if (msg.includes('MONGODB_UNAVAILABLE') || msg.includes('503')) {
          showErr('MongoDB недоступна — сохраните в JSON-файл');
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
      showOk('Текстовая сводка скачана (Dev)');
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Ошибка экспорта');
    }
  }, [bootstrapMode, buildDraft, getDraftParams, showOk, showErr]);

  const exportHashLink = useCallback(async () => {
    if (bootstrapMode !== 'survey') return;
    try {
      const draft = buildDraft();
      const url = encodeSurveyDraftToUrl(draft);
      await copyTextToClipboard(url);
      showOk('Hash-ссылка черновика скопирована (Dev, без отчёта)');
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Не удалось создать ссылку');
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
        throw new Error('Укажите имя клиента перед публикацией ссылки');
      }
      const report = getDraftParams().lastCalcReport;
      if (!report || !parseCommercialBomFromReport(report)) {
        throw new Error('Нет финансового итога — дождитесь расчёта');
      }

      const id = await ensureProjectSaved();
      const published = await publishProjectShare(id);
      setPublicPath(published.publicPath);
      const shareUrl = buildPublicShareUrlFromToken(published.shareToken);
      await copyTextToClipboard(shareUrl);
      setShareToastOpen(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось опубликовать ссылку';
      if (msg.includes('MONGODB_UNAVAILABLE') || msg.includes('503')) {
        showErr('MongoDB недоступна — публикация ссылки невозможна');
      } else if (msg.includes('Буфер обмена')) {
        showErr('Буфер обмена недоступен — скопируйте ссылку вручную из Dev');
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
      showErr('Нет projectId');
      return;
    }
    try {
      await revokeProjectShare(projectId);
      setPublicPath(null);
      showOk('Публичная ссылка отозвана (Dev)');
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Не удалось отозвать ссылку');
    }
  }, [projectId, showOk, showErr]);

  const printPdf = useCallback(
    (includeTechnical: boolean) => {
      if (bootstrapMode !== 'survey') return;
      if (!projectId) {
        showErr('Сохраните проект на сервер, чтобы скачать PDF');
        return;
      }
      void (async () => {
        try {
          await downloadProjectPdf(projectId, { includeTechnical });
          showOk('PDF скачан');
        } catch (e) {
          showErr(e instanceof Error ? e.message : 'Не удалось скачать PDF');
        }
      })();
    },
    [bootstrapMode, projectId, showOk, showErr],
  );

  const refreshProjectList = useCallback(async () => {
    try {
      await refetchProjects();
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Не удалось загрузить проекты');
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
        showOk(`Загружен проект: ${result.clientName}`);
        void refetchCalculations();
      } catch (e) {
        showErr(e instanceof Error ? e.message : 'Не удалось открыть проект');
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
        showOk('Загружен сохранённый расчёт');
      } catch (e) {
        showErr(e instanceof Error ? e.message : 'Не удалось загрузить расчёт');
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
        'Выйти из проекта? Несохранённые данные текущей анкеты будут сброшены.',
      );
      if (!ok) return;
    }
    exitToStart();
  }, [exitToStart, needsResetConfirm, projectId]);

  const startNewProject = useCallback(() => {
    if (needsResetConfirm()) {
      const ok = window.confirm(
        'Начать новый проект? Несохранённые данные текущей анкеты будут сброшены.',
      );
      if (!ok) return;
    }
    exitToStart();
  }, [needsResetConfirm, exitToStart]);

  const report = getDraftParams().lastCalcReport ?? null;
  const canPrintPdf =
    Boolean(projectId) && parseCommercialBomFromReport(report) != null;
  const canPublishShare = Boolean(clientName.trim()) && canPrintPdf;

  return {
    statusMessage,
    statusError,
    fileInputRef,
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
    openProjectsPanel,
    loadProjectById,
    loadCalculationById,
    startNewProject,
    refreshProjectList,
    buildDraft,
    runManualCalc,
  };
}
