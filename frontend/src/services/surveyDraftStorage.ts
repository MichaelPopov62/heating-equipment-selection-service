/**
 * Назначение: Локальное хранение черновика анкеты (localStorage).
 * Описание: SSOT ключа heatcalc:survey-draft:v1; read через migrateSurveyDraft.
 */

import type { SurveyDraft } from '../types/surveyDraft';
import { parseSurveyDraft } from '../utils/parseSurveyDraft';

export const SURVEY_DRAFT_STORAGE_KEY = 'heatcalc:survey-draft:v1';

/**
 * @returns {SurveyDraft | null}
 */
export function loadSurveyDraftFromStorage(): SurveyDraft | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SURVEY_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parseSurveyDraft(parsed);
  } catch {
    if (import.meta.env.DEV) {
      console.warn('[survey-draft-storage] corrupt JSON — clearing key');
    }
    localStorage.removeItem(SURVEY_DRAFT_STORAGE_KEY);
    return null;
  }
}

/**
 * @param draft
 */
export function saveSurveyDraftToStorage(draft: SurveyDraft): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SURVEY_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

/**
 *
 */
export function clearSurveyDraftStorage(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SURVEY_DRAFT_STORAGE_KEY);
}

/**
 * Черновик считается «пустым» — не сохраняем в storage.
 *
 * @param draft
 * @returns {boolean}
 */
export function isPersistableSurveyDraft(draft: SurveyDraft): boolean {
  if (draft.rooms.length > 0) return true;
  if (draft.clientName.trim() !== '' && draft.clientName.trim() !== 'Без имени') {
    return true;
  }
  if (draft.lastCalcReport != null) return true;
  return false;
}
