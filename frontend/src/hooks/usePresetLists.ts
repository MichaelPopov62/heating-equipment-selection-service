/**
 * Назначение: Хук фильтрации пресетов по kind.
 * Описание: Списки стен, утеплителей, окон, пола, потолка и кровли для селектов форм.
 */

import { useMemo } from 'react';
import type { EnvelopePreset } from '../types/envelope';
import {
  DEFAULT_SFTK_INSULATION_PRESET_ID,
  filterStructuralWallPresets,
} from '../data/fallbackEnvelopePresets';
import { envelopePresetKindNormalized, sortWallPresetsForDisplay } from '../utils/envelopePresetKind';

/** Списки пресетов по kind: стены (несущий слой) отдельно от утеплителей. */
export function usePresetLists(envelopePresets: EnvelopePreset[]) {
  return useMemo(() => {
    const windowPresets = envelopePresets.filter(
      (p) => envelopePresetKindNormalized(p) === 'window',
    );
    const floorPresets = envelopePresets.filter(
      (p) => envelopePresetKindNormalized(p) === 'floor',
    );
    const ceilingPresets = envelopePresets.filter(
      (p) => envelopePresetKindNormalized(p) === 'ceiling',
    );
    const roofPresets = envelopePresets.filter(
      (p) => envelopePresetKindNormalized(p) === 'roof',
    );
    const wallPresets = sortWallPresetsForDisplay(filterStructuralWallPresets(envelopePresets));
    const insulationPresets = envelopePresets.filter(
      (p) => envelopePresetKindNormalized(p) === 'insulation',
    );
    const sftkInsulationPresets = insulationPresets.filter(
      (p) => p.id === DEFAULT_SFTK_INSULATION_PRESET_ID,
    );
    const ventilatedInsulationPresets = insulationPresets.filter((p) =>
      p.id.startsWith('insul_minwool_'),
    );
    return {
      wallPresets,
      windowPresets,
      floorPresets,
      ceilingPresets,
      roofPresets,
      insulationPresets,
      sftkInsulationPresets,
      ventilatedInsulationPresets,
    };
  }, [envelopePresets]);
}
