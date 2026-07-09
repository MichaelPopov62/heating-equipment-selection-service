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
 * @param {ManifoldApplication | string | null | undefined} application
 * @returns {string}
 */
export function manifoldApplicationLabel(application: ManifoldApplication | string | null | undefined): string {
  if (application === 'radiator' || application === 'underfloor') {
    return LABELS[application];
  }
  return application != null && String(application).trim() ? String(application) : '—';
}
