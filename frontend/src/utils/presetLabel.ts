/**
 * Назначение: Подпись пресета ограждения.
 * Описание: Единая функция envelopePresetLabel для селектов и сводок UI.
 */

import type { EnvelopePreset } from '../types/envelope';

/** Единый формат подписи пресета для селектов (ObjectMetaForm, помещения). */
export function envelopePresetLabel(p: EnvelopePreset): string {
  const c = p.construction.trim();
  const m = p.material.trim();
  if (c && m) return `${c} — ${m}`;
  return c || m || p.id;
}
