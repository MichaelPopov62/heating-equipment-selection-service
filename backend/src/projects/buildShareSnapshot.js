/**
 * Назначение: whitelist-снимок отчёта для публичной презентации (без survey/input).
 */

import { isPlainObject } from '../utils/isPlainObject.js';

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function asObject(value) {
  return isPlainObject(value) ? value : null;
}

/**
 * @param {Record<string, unknown> | null} matching
 * @param {string} key
 * @returns {unknown}
 */
function pickMatching(matching, key) {
  if (!matching) return undefined;
  return matching[key] !== undefined ? matching[key] : undefined;
}

/**
 * Строит shareSnapshot из полного CalcReport + meta проекта.
 * Только поля для UI сметы / оборудования / краткого техблока.
 *
 * @param {{
 *   clientName: string,
 *   label?: string | null,
 *   report: unknown,
 * }} args
 * @returns {import('../types/shared-types.js').ProjectShareSnapshot}
 */
export function buildShareSnapshot(args) {
  const report = asObject(args.report);
  if (!report) {
    /** @type {Error & import('../types/shared-types.js').AppErrorLike} */
    const err = new Error('Нет отчёта для публикации ссылки');
    err.statusCode = 400;
    err.code = 'SHARE_REPORT_REQUIRED';
    throw err;
  }

  const commercial = report.commercial;
  if (!isPlainObject(commercial)) {
    /** @type {Error & import('../types/shared-types.js').AppErrorLike} */
    const err = new Error('В отчёте нет финансовой сметы (commercial)');
    err.statusCode = 400;
    err.code = 'SHARE_COMMERCIAL_REQUIRED';
    throw err;
  }

  const matching = asObject(report.matching);
  const calculations = asObject(report.calculations);
  const meta = asObject(report.meta);
  const temps = asObject(report.temps);
  const input = asObject(report.input);
  const building = input ? asObject(input.building) : null;
  const objectMeta = building ? asObject(building.objectMeta) : null;

  /** @type {'house' | 'apartment' | undefined} */
  let objectType;
  if (objectMeta?.objectType === 'house' || objectMeta?.objectType === 'apartment') {
    objectType = objectMeta.objectType;
  }

  /** @type {Record<string, unknown>} */
  const matchingSlice = {};
  for (const key of [
    'boiler',
    'radiators',
    'waterHeater',
    'indirectWaterHeater',
    'manifolds',
    'uniboxes',
    'hydraulics',
  ]) {
    const v = pickMatching(matching, key);
    if (v !== undefined) matchingSlice[key] = v;
  }

  /** @type {Record<string, unknown>} */
  const calculationsSlice = {};
  if (calculations) {
    for (const key of ['heatLoss', 'hotWater', 'underfloorHeating', 'hydraulics']) {
      if (calculations[key] !== undefined) calculationsSlice[key] = calculations[key];
    }
  }

  /** @type {import('../types/shared-types.js').ProjectShareSnapshot} */
  const snapshot = {
    schemaVersion: 1,
    clientName: String(args.clientName ?? '').trim() || 'Клиент',
    publishedAt: new Date().toISOString(),
    commercial,
    matching: matchingSlice,
    calculations: calculationsSlice,
  };

  if (args.label != null && String(args.label).trim()) {
    snapshot.label = String(args.label).trim();
  }
  if (objectType) snapshot.objectType = objectType;
  if (temps) snapshot.temps = temps;
  if (Array.isArray(report.warnings)) {
    snapshot.warnings = report.warnings.filter((w) => typeof w === 'string').slice(0, 50);
  }
  if (meta && typeof meta.generatedAt === 'string') {
    snapshot.reportGeneratedAt = meta.generatedAt;
  }
  if (meta && (meta.catalogSource === 'file' || meta.catalogSource === 'mongo')) {
    snapshot.catalogSource = meta.catalogSource;
  }

  return snapshot;
}
