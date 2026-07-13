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
    `Подводка радиаторов: ${label} (heatingSystem.radiatorConnection=${radiatorConnection}). `
      + 'Фильтрует панельный пул (K/Klasik vs VK/VKP). '
      + 'Тип прибора на объект задаётся radiatorEmitterPreference / Two-Pass Orchestrator — '
      + 'локальный flip section↔panel в комнате запрещён.',
  ];
}
