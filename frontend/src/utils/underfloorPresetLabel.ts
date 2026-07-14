/**
 * Назначение: Подписи пресетов ТП и финишных покрытий.
 */

import type { FlooringFinishMaterial, UnderfloorHeatingBasePreset } from '../types/underfloorHeating';

export function underfloorBasePresetLabel(p: UnderfloorHeatingBasePreset): string {
  const name = p.name.trim();
  return name || p.id;
}

export function flooringFinishLabel(m: FlooringFinishMaterial): string {
  const name = m.name.trim();
  return name || m.id;
}
