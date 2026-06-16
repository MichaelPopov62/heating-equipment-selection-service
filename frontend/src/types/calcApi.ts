/**
 * Назначение: Типы ответа API расчёта.
 * Описание: CalcReportJson и CalcOkPayload для успешного POST /api/v1/calc.
 */

export type CalcReportJson = Record<string, unknown>;

export interface CalcOkPayload {
  ok: true;
  report: CalcReportJson;
}
