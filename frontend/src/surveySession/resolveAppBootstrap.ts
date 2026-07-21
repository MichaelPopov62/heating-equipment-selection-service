/**
 * Назначение: Резолвер bootstrap — hash / localStorage / Start State.
 */

import type { SurveyDraft } from '../types/surveyDraft';
import { decodeSurveyDraftFromHash } from '../utils/surveyShare';

export type BootstrapResolution =
  | { mode: 'start' }
  | { mode: 'survey'; source: 'hash' | 'storage'; draft: SurveyDraft };

/**
 * @param hash — window.location.hash
 * @param storageDraft — результат loadSurveyDraftFromStorage или null
 * @returns {BootstrapResolution}
 */
export function resolveAppBootstrap(
  hash: string,
  storageDraft: SurveyDraft | null,
): BootstrapResolution {
  const hashDraft = decodeSurveyDraftFromHash(hash);
  if (hashDraft) {
    return { mode: 'survey', source: 'hash', draft: hashDraft };
  }
  if (storageDraft) {
    return { mode: 'survey', source: 'storage', draft: storageDraft };
  }
  return { mode: 'start' };
}

/**
 * Убрать hash survey из адресной строки после загрузки.
 */
export function clearSurveyHashFromUrl(): void {
  if (typeof window === 'undefined') return;
  if (!window.location.hash.startsWith('#survey=')) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
