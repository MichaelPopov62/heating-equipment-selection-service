/**
 * Назначение: notes подбора по схеме подводки радиаторов.
 * Описание: Одна строка в radiatorSelectionNotes; тип прибора — отдельно (emitter preference).
 */

import { radiatorConnectionLabel } from '../../../../shared/radiatorConnection.js';

/**
 * @param {'side' | 'bottom' | undefined | null} radiatorConnection
 * @returns {string[]}
 */
export function buildRadiatorConnectionSelectionNotes(radiatorConnection) {
  if (radiatorConnection !== 'side' && radiatorConnection !== 'bottom') {
    return [];
  }
  const label = radiatorConnectionLabel(radiatorConnection);
  return [
    `Підводка радіаторів: ${label} (heatingSystem.radiatorConnection=${radiatorConnection}). `
      + 'Фільтрує панельний пул (K/Klasik vs VK/VKP). '
      + 'Тип приладу на об’єкт задається radiatorEmitterPreference / Two-Pass Orchestrator — '
      + 'локальний flip section↔panel у кімнаті заборонено.',
  ];
}
