/**
 * Назначение: React Query mutations для операций с проектами.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  createProject,
  getProject,
  getProjectCalculation,
  listProjectCalculations,
  postProjectCalc,
  updateProject,
} from '../../services/projectsApi';
import type { CalcReportJson } from '../../types/calcApi';
import type { SurveyDraft } from '../../types/surveyDraft';
import { parseSurveyDraft } from '../../utils/parseSurveyDraft';
import { queryKeys } from '../queryKeys';

export type SaveProjectParams = {
  projectId: string | null;
  clientName: string;
  draft: SurveyDraft;
  withCalc: boolean;
  canRunCalc: boolean;
  buildCalcPayload: () => unknown;
};

export type SaveProjectResult = {
  projectId: string;
  report: CalcReportJson | null;
};

export type LoadProjectParams = {
  projectId: string;
};

export type LoadProjectResult = {
  draft: SurveyDraft | null;
  clientName: string;
  projectId: string;
  report: CalcReportJson | null;
};

export type LoadCalculationParams = {
  projectId: string;
  calculationId: string;
};

/**
 * @returns mutations и invalidate-хелперы для проектов
 */
export function useProjectMutations() {
  const queryClient = useQueryClient();

  const invalidateProjects = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
  }, [queryClient]);

  const saveProjectMutation = useMutation({
    mutationFn: async (params: SaveProjectParams): Promise<SaveProjectResult> => {
      const name = params.clientName.trim();
      if (!name) {
        throw new Error('Укажите имя клиента перед сохранением на сервер');
      }

      let id = params.projectId;
      if (!id) {
        const created = await createProject({
          clientName: name,
          survey: params.draft,
        });
        id = created.project.id;
      } else {
        await updateProject(id, { clientName: name, survey: params.draft });
      }

      let report: CalcReportJson | null = null;
      if (params.withCalc && params.canRunCalc && id) {
        const calcRes = await postProjectCalc(id, {
          calcInput: params.buildCalcPayload(),
          survey: params.draft,
        });
        report = calcRes.report;
      }

      return { projectId: id, report };
    },
    onSuccess: async () => {
      await invalidateProjects();
    },
  });

  const loadProjectMutation = useMutation({
    mutationFn: async (params: LoadProjectParams): Promise<LoadProjectResult> => {
      const res = await getProject(params.projectId, { includeLastCalculation: true });
      let draft: SurveyDraft | null = null;
      const surveyRaw = res.project.survey;
      if (surveyRaw && typeof surveyRaw === 'object') {
        draft = parseSurveyDraft(surveyRaw);
        draft.projectId = res.project.id;
        draft.clientName = res.project.clientName;
      }

      let report: CalcReportJson | null = null;
      const calcList = await listProjectCalculations(params.projectId, { limit: 10 });
      const latest = calcList.calculations[0];
      if (latest) {
        try {
          const full = await getProjectCalculation(params.projectId, latest.id);
          report = full.calculation.report;
        } catch {
          /* отчёт опционален */
        }
      }

      return {
        draft,
        clientName: res.project.clientName,
        projectId: res.project.id,
        report,
      };
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.projectCalculations(variables.projectId),
      });
    },
  });

  const loadCalculationMutation = useMutation({
    mutationFn: async (params: LoadCalculationParams) => {
      const res = await getProjectCalculation(params.projectId, params.calculationId);
      return res.calculation.report;
    },
  });

  return {
    saveProjectMutation,
    loadProjectMutation,
    loadCalculationMutation,
    invalidateProjects,
  };
}
