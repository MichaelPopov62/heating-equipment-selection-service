/**
 * Назначение: Подписи назначения коллектора в UI.
 * Описание: Единая функция для справочника каталога и будущего блока сметы.
 */

import type { ManifoldApplication } from '../services/catalogTypes';

const LABELS: Record<ManifoldApplication, string> = {
  radiator: 'Радиаторный контур',
  underfloor: 'Тёплый пол',
};

/**
 * @param application — назначение коллектора из каталога
 * @returns подпись для UI
 */
export function manifoldApplicationLabel(application: string | null | undefined): string {
  if (application === 'radiator' || application === 'underfloor') {
    return LABELS[application];
  }
  if (typeof application === 'string' && application.trim()) {
    return application;
  }
  return '—';
}
