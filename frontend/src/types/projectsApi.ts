/**
 * Назначение: DTO REST API проектов.
 * Описание: Типы списков, деталей проекта, расчётов и ответов сервера.
 */

import type { CalcReportJson } from './calcApi';

export type CalculationSummary = {
  heatLossKw?: number;
  hotWaterPowerKw?: number;
  boilerRequiredKw?: number;
  boilerModel?: string;
  insideTempC?: number;
  outsideTempC?: number;
  objectType?: 'house' | 'apartment';
  warningsCount?: number;
  generatedAt?: string;
};

export type ProjectListItem = {
  id: string;
  clientName: string;
  label?: string;
  createdAt: string;
  updatedAt: string;
  calculationsCount?: number;
};

export type ProjectDetail = ProjectListItem & {
  survey?: unknown;
  lastCalcInput?: unknown;
  lastCalculation?: CalculationListItem;
};

export type CalculationListItem = {
  id: string;
  projectId: string;
  summary: CalculationSummary;
  createdAt: string;
};

export type CalculationDetail = CalculationListItem & {
  calcInput: unknown;
  report: CalcReportJson;
};

export type ProjectsListResponse = {
  ok: true;
  projects: ProjectListItem[];
  total: number;
  limit: number;
  skip: number;
};

export type ProjectGetResponse = {
  ok: true;
  project: ProjectDetail;
};

export type ProjectCreateResponse = {
  ok: true;
  project: ProjectDetail;
};

export type ProjectCalcResponse = {
  ok: true;
  report: CalcReportJson;
  calculation: CalculationListItem;
  project: ProjectDetail;
};

export type CalculationsListResponse = {
  ok: true;
  calculations: CalculationListItem[];
  total: number;
  limit: number;
  skip: number;
};

export type CalculationGetResponse = {
  ok: true;
  calculation: CalculationDetail;
};
