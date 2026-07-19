/**
 * Назначение: детект пропуска подбора радиаторов (ufh_only).
 * Описание: SSOT — matching.radiators.skippedReason; черновик — ufhPresetId.
 */

import type { UfhModePresetId } from '../types/ufhModePreset';
import type { ParsedRadiatorsMatching } from './parseRadiatorsMatchingFromReport';

export const RADIATORS_SKIPPED_UFH_ONLY = 'ufh_only' as const;

/**
 * Подбор радиаторов пропущен по флагу API.
 *
 * @param radiators
 */
export function isRadiatorsMatchingSkipped(
  radiators: ParsedRadiatorsMatching | null | undefined,
): boolean {
  return radiators?.skippedReason === RADIATORS_SKIPPED_UFH_ONLY;
}

/**
 * Режим анкеты «только тёплый пол» (до ответа API или параллельно с ним).
 *
 * @param ufhPresetId
 */
export function isUfhOnlySurveyMode(
  ufhPresetId: UfhModePresetId | null | undefined,
): boolean {
  return ufhPresetId === 'ufh_only';
}
