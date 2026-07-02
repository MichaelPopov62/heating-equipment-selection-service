/**
 * Назначение: Хук управления проектами анкеты.
 * Описание: Сохранение, загрузка, экспорт, share-ссылка и диалог проектов на сервере.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useProjectMutations } from '../query/mutations/useProjectMutations';
import { useProjectCalculationsQuery } from '../query/queries/useProjectCalculationsQuery';
import { useProjectsListQuery } from '../query/queries/useProjectsListQuery';
import type { CalcReportJson } from '../types/calcApi';
import type { SurveyDraft } from '../types/surveyDraft';
import { buildSurveyDraft } from '../utils/buildSurveyDraft';
import { downloadJsonFile, downloadTextFile } from '../utils/fileDownload';
import { parseSurveyDraft } from '../utils/parseSurveyDraft';
import {
  buildSurveyTextSummary,
  copyTextToClipboard,
  decodeSurveyDraftFromHash,
  encodeSurveyDraftToUrl,
  shareSurveyText,
} from '../utils/surveyShare';

export type UseSurveyProjectParams = {
  /** Поля анкеты без clientName/projectId (их хранит хук). */
  getDraftParams: () => Omit<
    Parameters<typeof buildSurveyDraft>[0],
    'savedAt' | 'schemaVersion' | 'clientName' | 'projectId'
  >;
  applyDraft: (draft: SurveyDraft) => void;
  buildCalcPayload: () => unknown;
  canRunCalc: boolean;
  setCalcReport: (report: CalcReportJson | null) => void;
};

export function useSurveyProject({
  getDraftParams,
  applyDraft,
  buildCalcPayload,
  canRunCalc,
  setCalcReport,
}: UseSurveyProjectParams) {
  const [clientName, setClientName] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hashAppliedRef = useRef(false);

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
    window.setTimeout(() => setStatusMessage(null), 4000);
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
    },
    [applyDraft],
  );

  useEffect(() => {
    if (hashAppliedRef.current) return;
    const draft = decodeSurveyDraftFromHash(window.location.hash);
    if (!draft) return;
    hashAppliedRef.current = true;
    queueMicrotask(() => {
      applyDraftAndMeta(draft);
      showOk('Анкета загружена из ссылки');
    });
  }, [applyDraftAndMeta, showOk]);

  const saveToFile = useCallback(() => {
    try {
      const draft = buildDraft();
      const safe = draft.clientName
        .replace(/[^\p{L}\p{N}\-_]+/gu, '_')
        .slice(0, 40);
      const date = draft.savedAt.slice(0, 10);
      downloadJsonFile(`heatcalc-${safe}-${date}.json`, draft);
      showOk('Файл JSON сохранён');
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Не удалось сохранить файл');
    }
  }, [buildDraft, showOk, showErr]);

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
          showOk('Проект и расчёт сохранены на сервере');
        } else if (withCalc && !canRunCalc) {
          showOk('Проект сохранён (расчёт пропущен: неполная анкета)');
        } else {
          showOk('Проект сохранён на сервере');
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
      buildDraft,
      buildCalcPayload,
      canRunCalc,
      clientName,
      projectId,
      saveProjectMutation,
      setCalcReport,
      showOk,
      showErr,
    ],
  );

  const exportTextFile = useCallback(() => {
    try {
      const draft = buildDraft();
      const report = getDraftParams().lastCalcReport ?? null;
      const text = buildSurveyTextSummary(draft, report);
      const safe = draft.clientName
        .replace(/[^\p{L}\p{N}\-_]+/gu, '_')
        .slice(0, 40);
      downloadTextFile(`heatcalc-${safe}-summary.txt`, text);
      showOk('Текстовая сводка скачана');
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Ошибка экспорта');
    }
  }, [buildDraft, getDraftParams, showOk, showErr]);

  const exportShare = useCallback(async () => {
    try {
      const draft = buildDraft();
      const report = getDraftParams().lastCalcReport ?? null;
      const text = buildSurveyTextSummary(draft, report);
      const shared = await shareSurveyText(
        `HeatCalc — ${draft.clientName}`,
        text,
      );
      showOk(shared ? 'Сводка отправлена' : 'Сводка скопирована в буфер');
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Не удалось поделиться');
    }
  }, [buildDraft, getDraftParams, showOk, showErr]);

  const exportLink = useCallback(async () => {
    try {
      const draft = buildDraft();
      const url = encodeSurveyDraftToUrl(draft);
      await copyTextToClipboard(url);
      showOk('Ссылка с анкетой скопирована (без отчёта)');
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Не удалось создать ссылку');
    }
  }, [buildDraft, showOk, showErr]);

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
        }
        if (result.report) {
          setCalcReport(result.report);
        }
        setProjectsOpen(false);
        showOk(`Загружен проект: ${result.clientName}`);
        void refetchCalculations();
      } catch (e) {
        showErr(e instanceof Error ? e.message : 'Не удалось открыть проект');
      }
    },
    [
      applyDraftAndMeta,
      loadProjectMutation,
      refetchCalculations,
      setCalcReport,
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

  const startNewProject = useCallback(() => {
    setProjectId(null);
    showOk('Новый проект — сохраните на сервер, чтобы получить id');
  }, [showOk]);

  return {
    clientName,
    setClientName,
    projectId,
    statusMessage,
    statusError,
    fileInputRef,
    projectsOpen,
    setProjectsOpen,
    projectsLoading,
    projectList,
    calculations,
    saveToFile,
    saveToServer,
    openFilePicker,
    handleFileSelected,
    exportTextFile,
    exportShare,
    exportLink,
    openProjectsPanel,
    loadProjectById,
    loadCalculationById,
    startNewProject,
    refreshProjectList,
  };
}
