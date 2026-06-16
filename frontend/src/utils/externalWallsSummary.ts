/**
 * Назначение: Сводка наружных стен объекта.
 * Описание: Краткий текст для блока комнат из objectMeta.externalWalls.
 */

import type { EnvelopePreset, ObjectMetaValue } from '../types/envelope';
import { envelopePresetLabel } from './presetLabel';

/** Краткая подпись наружных стен объекта для блока помещений. */
export function formatExternalWallsSummary(
  objectMeta: ObjectMetaValue,
  wallPresets: EnvelopePreset[],
  insulationPresets: EnvelopePreset[],
): string {
  const ew = objectMeta.externalWalls;
  const wall =
    wallPresets.find((p) => p.id === ew.presetId) ??
    ({ id: ew.presetId, material: ew.presetId, construction: 'стена' } as EnvelopePreset);
  const parts = [envelopePresetLabel(wall)];
  if (ew.thicknessMm != null) parts.push(`${ew.thicknessMm} мм`);

  const facade = ew.facadeSystem ?? 'none';
  if (facade === 'none') {
    parts.push('без утеплителя');
    return parts.join(', ');
  }

  const insul =
    insulationPresets.find((p) => p.id === ew.insulationPresetId) ??
    (ew.insulationPresetId
      ? ({ id: ew.insulationPresetId, material: ew.insulationPresetId, construction: 'утеплитель' } as EnvelopePreset)
      : null);
  if (facade === 'sftk') parts.push('+ СФТК');
  if (facade === 'ventilated') parts.push('+ вентфасад');
  if (insul) parts.push(envelopePresetLabel(insul));
  if (ew.insulationThicknessMm != null) parts.push(`утепл. ${ew.insulationThicknessMm} мм`);
  return parts.join(', ');
}
