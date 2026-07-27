/**
 * Назначение: Локальный fallback пресетов ограждений.
 * Описание: Статический набор пресетов при недоступности GET /api/v1/presets/envelope.
 */

import type { EnvelopePreset } from '../types/envelope';
import { LEGACY_COMBINED_WALL_PRESET_IDS } from '../constants/compatLegacyIds';

/** Только несущие стены (kind=wall), без утеплителя и без легаси. */
export function filterStructuralWallPresets(presets: EnvelopePreset[]): EnvelopePreset[] {
  return presets.filter(
    (p) => p.kind === 'wall' && !LEGACY_COMBINED_WALL_PRESET_IDS.has(p.id),
  );
}

/** ППС 16Ф для СФТК. */
export const DEFAULT_SFTK_INSULATION_PRESET_ID = 'insul_sftk_pps16f';

/**
 * Минимальный набор пресетов, если API недоступен.
 * ID и λ должны совпадать с backend/src/logic/envelopePresets.js.
 */
export const FALLBACK_ENVELOPE_PRESETS: EnvelopePreset[] = [
  {
    id: 'wall_gas_concrete_d500',
    kind: 'wall',
    construction: 'зовнішня стіна',
    material: 'Газобетон D500',
    description: 'Несучий шар без утеплювача.',
    thicknessOptionsMm: [200, 300, 375, 400, 500],
    uValue: 0.41,
    uModel: { lambdaWmK: 0.14, surfaceR: 0.158, extraR: 0 },
  },
  {
    id: 'wall_brick_solid',
    kind: 'wall',
    construction: 'зовнішня стіна',
    material: 'Цегла (повнотіла)',
    description: 'Несучий шар без утеплювача.',
    thicknessOptionsMm: [250, 380, 510, 640],
    uValue: 1.47,
    uModel: { lambdaWmK: 0.77, surfaceR: 0.158, extraR: 0 },
  },
  {
    id: 'wall_brick_hollow',
    kind: 'wall',
    construction: 'зовнішня стіна',
    material:
      'Цегла порожиста (1 NF 250*120*65, 1.4 NF 250*120*88, 2.1 NF 250*120*138)',
    description: 'Несучий шар без утеплювача.',
    thicknessOptionsMm: [250, 380, 510, 640],
    uValue: 1.26,
    uModel: { lambdaWmK: 0.4, surfaceR: 0.158, extraR: 0 },
  },
  {
    id: 'wall_monolithic_concrete_200',
    kind: 'wall',
    construction: 'зовнішня стіна',
    material: 'моноліт-бетон 200 мм',
    description: 'Несучий монолітний бетон, без утеплювача.',
    thicknessOptionsMm: [200],
    uValue: 3.15,
    uModel: { lambdaWmK: 1.7, surfaceR: 0.158, extraR: 0 },
  },
  {
    id: 'wall_limestone_400',
    kind: 'wall',
    construction: 'зовнішня стіна',
    material: 'вапняк 400 мм',
    description: 'Несучий шар без утеплювача.',
    thicknessOptionsMm: [400],
    uValue: 1.0,
    uModel: { lambdaWmK: 0.55, surfaceR: 0.158, extraR: 0 },
  },
  {
    id: 'wall_shell_400',
    kind: 'wall',
    construction: 'зовнішня стіна',
    material: 'ракушняк 400 мм',
    description: 'Несучий шар без утеплювача.',
    thicknessOptionsMm: [400],
    uValue: 0.92,
    uModel: { lambdaWmK: 0.5, surfaceR: 0.158, extraR: 0 },
  },
  {
    id: 'insul_sftk_pps16f',
    kind: 'insulation',
    construction: 'утеплювач',
    material: 'ППС 16Ф (ПСБ-С 25Ф), СФТК',
    description: 'Пінополістирол лише в системі мокрого фасаду (СП 50.13330).',
    thicknessOptionsMm: [50, 80, 100, 120, 150, 200],
    uModel: { lambdaWmK: 0.039, surfaceR: 0, extraR: 0 },
  },
  {
    id: 'insul_minwool_50',
    kind: 'insulation',
    construction: 'утеплювач',
    material: 'Мінеральна вата ~50 кг/м³',
    description: 'Відкритий/вентильований фасад.',
    thicknessOptionsMm: [50, 80, 100, 120, 150, 200],
    uModel: { lambdaWmK: 0.045, surfaceR: 0, extraR: 0 },
  },
  {
    id: 'insul_minwool_80',
    kind: 'insulation',
    construction: 'утеплювач',
    material: 'Мінеральна вата ~80 кг/м³',
    description: 'Відкритий/вентильований фасад.',
    thicknessOptionsMm: [50, 80, 100, 120, 150, 200],
    uModel: { lambdaWmK: 0.041, surfaceR: 0, extraR: 0 },
  },
  {
    id: 'insul_minwool_100',
    kind: 'insulation',
    construction: 'утеплювач',
    material: 'Мінеральна вата ~100 кг/м³',
    description: 'Відкритий/вентильований фасад.',
    thicknessOptionsMm: [50, 80, 100, 120, 150, 200],
    uModel: { lambdaWmK: 0.039, surfaceR: 0, extraR: 0 },
  },
  {
    id: 'insul_minwool_150',
    kind: 'insulation',
    construction: 'утеплювач',
    material: 'Мінеральна вата ~150 кг/м³',
    description: 'Відкритий/вентильований фасад.',
    thicknessOptionsMm: [50, 80, 100, 120, 150, 200],
    uModel: { lambdaWmK: 0.038, surfaceR: 0, extraR: 0 },
  },
  {
    id: 'window_pvc_double_chamber_3_glass',
    kind: 'window',
    construction: 'вікно',
    material: 'ПВХ двокамерне (3 скла)',
    description: 'Стандартне ПВХ-вікно: 2 камери/3 скла.',
    uValue: 1.1,
  },
  {
    id: 'window_pvc_triple_chamber_4_glass',
    kind: 'window',
    construction: 'вікно',
    material: 'ПВХ три камери (4 скла)',
    description: 'ПВХ-вікно підвищеної енергоефективності: 3 камери/4 скла.',
    uValue: 0.85,
  },
  {
    id: 'ceiling_concrete_insulated',
    kind: 'ceiling',
    construction: 'стеля',
    material: 'бетон + утеплювач',
    description: 'Стеля/перекриття з утепленням (орієнтовний U).',
    uValue: 0.18,
  },
  {
    id: 'roof_concrete_insulated_flat',
    kind: 'roof',
    construction: 'поєднане покриття',
    material: 'з/б плита + утеплювач',
    description: 'Безгорищне покриття (орієнтир U: 0.15–0.18).',
    uValue: 0.16,
  },
  {
    id: 'floor_concrete_uninsulated',
    kind: 'floor',
    construction: 'підлога',
    material: 'бетон без утеплення',
    description: 'Підлога без утеплення — високий U (великі втрати).',
    uValue: 0.6,
  },
  {
    id: 'floor_slab_rough_screed_eps_finish_screed_porcelain',
    kind: 'floor',
    construction: 'підлога',
    material:
      'бетонна плита + чорнова стяжка + ЕППС + чистова стяжка + керамограніт',
    uValue: 0.35,
    description:
      'Орієнтир U при типовій товщині ЕППС: фактичний U залежить від товщини утеплювача та вузлів.',
  },
];

/** Дефолтный пресет окна (есть и во фолбэке, и в backend). */
export const DEFAULT_WINDOW_PRESET_ID = 'window_pvc_double_chamber_3_glass';
