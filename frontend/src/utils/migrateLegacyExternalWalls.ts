/**
 * Назначение: Миграция устаревших пресетов стен.
 * Описание: Преобразование комбинированных wall_pps_* в objectMeta.externalWalls.
 */

import { LEGACY_COMBINED_WALL_PRESET_IDS } from '../constants/compatLegacyIds';
import { DEFAULT_SFTK_INSULATION_PRESET_ID } from '../data/fallbackEnvelopePresets';
import type { ObjectMetaValue } from '../types/envelope';
import { warnCompatMigration } from './compatTelemetry';

const DEFAULT_STRUCTURAL_WALL_PRESET_ID = 'wall_gas_concrete_d500';

/**
 * Миграция устаревших комбинированных пресетов «стена + ППС» → несущий слой + СФТК.
 * Также исправляет ошибочный выбор kind=insulation в presetId стены.
 */
export function migrateObjectMetaExternalWalls(
  externalWalls: ObjectMetaValue['externalWalls'],
): ObjectMetaValue['externalWalls'] {
  const presetId = String(externalWalls.presetId ?? '').trim();
  if (!presetId) return externalWalls;

  if (LEGACY_COMBINED_WALL_PRESET_IDS.has(presetId)) {
    const insulationThicknessMm = presetId === 'wall_pps_50' ? 50 : 100;
    warnCompatMigration('ExternalWalls', `combined preset ${presetId}`);
    return {
      ...externalWalls,
      presetId: DEFAULT_STRUCTURAL_WALL_PRESET_ID,
      thicknessMm: externalWalls.thicknessMm ?? 375,
      facadeSystem: 'sftk',
      insulationPresetId: DEFAULT_SFTK_INSULATION_PRESET_ID,
      insulationThicknessMm: externalWalls.insulationThicknessMm ?? insulationThicknessMm,
    };
  }

  if (presetId.startsWith('insul_')) {
    const facadeSystem = presetId === DEFAULT_SFTK_INSULATION_PRESET_ID ? 'sftk' : 'ventilated';
    warnCompatMigration('ExternalWalls', `insulation in wall presetId: ${presetId}`);
    return {
      ...externalWalls,
      presetId: DEFAULT_STRUCTURAL_WALL_PRESET_ID,
      thicknessMm: externalWalls.thicknessMm ?? 300,
      facadeSystem,
      insulationPresetId: presetId,
      insulationThicknessMm: externalWalls.insulationThicknessMm ?? 100,
    };
  }

  return externalWalls;
}
