/**
 * Назначение: сборка ProjectExportBundle из частей (сессия + API).
 */

import type { CalculationDetail } from '../types/projectsApi';
import {
  mergeSurveyForExport,
  PROJECT_EXPORT_SCHEMA_VERSION,
  type ProjectExportBundle,
  type ProjectExportCalculationItem,
} from '../types/projectExport';
import type { SurveyDraft } from '../types/surveyDraft';
import { isRecord } from './jsonGuards';
import { stripCalculationExportFields, stripMongoExportFields } from './stripMongoExportFields';

/**
 * @param detail
 */
function toExportCalculationItem(detail: CalculationDetail): ProjectExportCalculationItem {
  const stripped = stripCalculationExportFields({
    calcInput: detail.calcInput,
    report: detail.report,
    summary: detail.summary,
    sourceCreatedAt: detail.createdAt,
  });
  return {
    calcInput: stripped.calcInput,
    report: stripped.report as ProjectExportCalculationItem['report'],
    summary: stripped.summary as ProjectExportCalculationItem['summary'],
    ...(typeof stripped.sourceCreatedAt === 'string'
      ? { sourceCreatedAt: stripped.sourceCreatedAt }
      : {}),
  };
}

/**
 * @param calculations
 */
function sortCalculationsForExport(
  calculations: ProjectExportCalculationItem[],
): ProjectExportCalculationItem[] {
  return [...calculations].sort((left, right) => {
    const leftTs = left.sourceCreatedAt ? Date.parse(left.sourceCreatedAt) : Number.NaN;
    const rightTs = right.sourceCreatedAt ? Date.parse(right.sourceCreatedAt) : Number.NaN;
    const leftKey = Number.isFinite(leftTs) ? leftTs : Number.MAX_SAFE_INTEGER;
    const rightKey = Number.isFinite(rightTs) ? rightTs : Number.MAX_SAFE_INTEGER;
    return leftKey - rightKey;
  });
}

export type BuildProjectExportBundleFromPartsParams = {
  projectId: string;
  clientName: string;
  label?: string;
  localDraft: SurveyDraft;
  serverSurvey: unknown;
  serverLastCalcInput: unknown;
  localLastCalcInput?: unknown;
  calculationsTotal: number;
  calculationDetails: CalculationDetail[];
};

/**
 * @param params
 */
export function buildProjectExportBundleFromParts(
  params: BuildProjectExportBundleFromPartsParams,
): ProjectExportBundle {
  const exportedAt = new Date().toISOString();
  const survey = mergeSurveyForExport(params.localDraft, params.serverSurvey);
  const lastCalcInput =
    params.serverLastCalcInput ?? params.localLastCalcInput ?? undefined;

  const calculations = sortCalculationsForExport(
    params.calculationDetails.map(toExportCalculationItem),
  );

  /** @type {ProjectExportBundle} */
  const bundle = {
    exportSchemaVersion: PROJECT_EXPORT_SCHEMA_VERSION,
    exportedAt,
    source: {
      projectId: params.projectId,
      calculationsTotal: params.calculationsTotal,
    },
    project: {
      clientName: params.clientName.trim() || 'Без имени',
      survey,
      ...(params.label ? { label: params.label } : {}),
      ...(lastCalcInput !== undefined ? { lastCalcInput } : {}),
    },
    calculations,
  };

  return stripMongoExportFields(bundle) as ProjectExportBundle;
}

/**
 * Fallback без projectId — только локальная сессия.
 *
 * @param localDraft
 * @param localLastCalcInput
 */
export function buildSessionOnlyExportBundle(
  localDraft: SurveyDraft,
  localLastCalcInput?: unknown,
): ProjectExportBundle {
  const exportedAt = new Date().toISOString();
  const survey = mergeSurveyForExport(localDraft, undefined);
  const report = localDraft.lastCalcReport;

  /** @type {ProjectExportCalculationItem[]} */
  const calculations: ProjectExportCalculationItem[] = [];
  if (report && typeof report === 'object') {
    const calcInput =
      localLastCalcInput
      ?? (isRecord(report) && report.input !== undefined ? report.input : {});
    calculations.push({
      calcInput,
      report,
      summary: {},
      sourceCreatedAt: exportedAt,
    });
  }

  const bundle: ProjectExportBundle = {
    exportSchemaVersion: PROJECT_EXPORT_SCHEMA_VERSION,
    exportedAt,
    project: {
      clientName: localDraft.clientName.trim() || 'Без имени',
      survey,
      ...(localLastCalcInput !== undefined ? { lastCalcInput: localLastCalcInput } : {}),
    },
    calculations,
  };

  return stripMongoExportFields(bundle) as ProjectExportBundle;
}
