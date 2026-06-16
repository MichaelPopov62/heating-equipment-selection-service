/**
 * Назначение: Хук управления проектами анкеты.
 * Описание: Сохранение, загрузка, экспорт, share-ссылка и диалог проектов на сервере.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createProject,
  getProject,
  getProjectCalculation,
  listProjectCalculations,
  listProjects,
  postProjectCalc,
  updateProject,
} from '../services/projectsApi';
import type { CalcReportJson } from '../types/calcApi';
import type {
  CalculationListItem,
  ProjectListItem,
} from '../types/projectsApi';
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
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectList, setProjectList] = useState<ProjectListItem[]>([]);
  const [calculations, setCalculations] = useState<CalculationListItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hashAppliedRef = useRef(false);

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
      if (draft.lastCalcReport) setCalcReport(draft.lastCalcReport);
    },
    [applyDraft, setCalcReport],
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
      const name = clientName.trim();
      if (!name) {
        showErr('Укажите имя клиента перед сохранением на сервер');
        return;
      }
      try {
        const draft = buildDraft();
        let id = projectId;
        if (!id) {
          const created = await createProject({
            clientName: name,
            survey: draft,
          });
          id = created.project.id;
          setProjectId(id);
        } else {
          await updateProject(id, { clientName: name, survey: draft });
        }

        if (withCalc && canRunCalc && id) {
          const calcRes = await postProjectCalc(id, {
            calcInput: buildCalcPayload(),
            survey: draft,
          });
          setCalcReport(calcRes.report);
          showOk('Проект и расчёт сохранены на сервере');
        } else {
          showOk(
            withCalc && !canRunCalc
              ? 'Проект сохранён (расчёт пропущен: неполная анкета)'
              : 'Проект сохранён на сервере',
          );
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
      clientName,
      projectId,
      buildDraft,
      buildCalcPayload,
      canRunCalc,
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
    setProjectsLoading(true);
    try {
      const res = await listProjects({ limit: 50 });
      setProjectList(res.projects);
    } catch (e) {
      showErr(e instanceof Error ? e.message : 'Не удалось загрузить проекты');
      setProjectList([]);
    } finally {
      setProjectsLoading(false);
    }
  }, [showErr]);

  const openProjectsPanel = useCallback(() => {
    setProjectsOpen(true);
    void refreshProjectList();
  }, [refreshProjectList]);

  const loadProjectById = useCallback(
    async (id: string) => {
      try {
        const res = await getProject(id, { includeLastCalculation: true });
        const surveyRaw = res.project.survey;
        if (surveyRaw && typeof surveyRaw === 'object') {
          const draft = parseSurveyDraft(surveyRaw);
          draft.projectId = res.project.id;
          draft.clientName = res.project.clientName;
          applyDraftAndMeta(draft);
        } else {
          setClientName(res.project.clientName);
          setProjectId(res.project.id);
        }
        const calcList = await listProjectCalculations(id, { limit: 10 });
        setCalculations(calcList.calculations);
        const latest = calcList.calculations[0];
        if (latest) {
          try {
            const full = await getProjectCalculation(id, latest.id);
            setCalcReport(full.calculation.report);
          } catch {
            /* отчёт опционален */
          }
        }
        setProjectsOpen(false);
        showOk(`Загружен проект: ${res.project.clientName}`);
      } catch (e) {
        showErr(e instanceof Error ? e.message : 'Не удалось открыть проект');
      }
    },
    [applyDraftAndMeta, setCalcReport, showOk, showErr],
  );

  const loadCalculationById = useCallback(
    async (calcId: string) => {
      if (!projectId) return;
      try {
        const res = await getProjectCalculation(projectId, calcId);
        setCalcReport(res.calculation.report);
        showOk('Загружен сохранённый расчёт');
      } catch (e) {
        showErr(e instanceof Error ? e.message : 'Не удалось загрузить расчёт');
      }
    },
    [projectId, setCalcReport, showOk, showErr],
  );

  const startNewProject = useCallback(() => {
    setProjectId(null);
    setCalculations([]);
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
