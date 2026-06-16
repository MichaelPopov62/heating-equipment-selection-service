/**
 * Назначение: Локальный fallback пресетов ограждений.
 * Описание: Статический набор пресетов при недоступности GET /api/v1/presets/envelope.
 */

import type { EnvelopePreset } from '../types/envelope';

/** ID устаревших комбинированных пресетов «стена + ППС» — не показывать в UI. */
export const LEGACY_COMBINED_WALL_PRESET_IDS = new Set(['wall_pps_50', 'wall_pps_100']);

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
    construction: 'наружная стена',
    material: 'Газобетон D500',
    description: 'Несущий слой без утеплителя.',
    thicknessOptionsMm: [200, 300, 375, 400, 500],
    uValue: 0.41,
    uModel: { lambdaWmK: 0.14, surfaceR: 0.158, extraR: 0 },
  },
  {
    id: 'wall_brick_solid',
    kind: 'wall',
    construction: 'наружная стена',
    material: 'Кирпич (полнотелый)',
    description: 'Несущий слой без утеплителя.',
    thicknessOptionsMm: [250, 380, 510, 640],
    uValue: 1.47,
    uModel: { lambdaWmK: 0.77, surfaceR: 0.158, extraR: 0 },
  },
  {
    id: 'wall_brick_hollow',
    kind: 'wall',
    construction: 'наружная стена',
    material:
      'Кирпич пустотелый (1 NF 250*120*65, 1.4 NF 250*120*88, 2.1 NF 250*120*138)',
    description: 'Несущий слой без утеплителя.',
    thicknessOptionsMm: [250, 380, 510, 640],
    uValue: 1.26,
    uModel: { lambdaWmK: 0.4, surfaceR: 0.158, extraR: 0 },
  },
  {
    id: 'wall_monolithic_concrete_200',
    kind: 'wall',
    construction: 'наружная стена',
    material: 'монолит-бетон 200 мм',
    description: 'Несущий монолитный бетон, без утеплителя.',
    thicknessOptionsMm: [200],
    uValue: 3.15,
    uModel: { lambdaWmK: 1.7, surfaceR: 0.158, extraR: 0 },
  },
  {
    id: 'wall_limestone_400',
    kind: 'wall',
    construction: 'наружная стена',
    material: 'известняк 400 мм',
    description: 'Несущий слой без утеплителя.',
    thicknessOptionsMm: [400],
    uValue: 1.0,
    uModel: { lambdaWmK: 0.55, surfaceR: 0.158, extraR: 0 },
  },
  {
    id: 'wall_shell_400',
    kind: 'wall',
    construction: 'наружная стена',
    material: 'ракушечник 400 мм',
    description: 'Несущий слой без утеплителя.',
    thicknessOptionsMm: [400],
    uValue: 0.92,
    uModel: { lambdaWmK: 0.5, surfaceR: 0.158, extraR: 0 },
  },
  {
    id: 'insul_sftk_pps16f',
    kind: 'insulation',
    construction: 'утеплитель',
    material: 'ППС 16Ф (ПСБ-С 25Ф), СФТК',
    description: 'Пенополистирол только в системе мокрого фасада (СП 50.13330).',
    thicknessOptionsMm: [50, 80, 100, 120, 150, 200],
    uModel: { lambdaWmK: 0.039, surfaceR: 0, extraR: 0 },
  },
  {
    id: 'insul_minwool_50',
    kind: 'insulation',
    construction: 'утеплитель',
    material: 'Минеральная вата ~50 кг/м³',
    description: 'Открытый/вентилируемый фасад.',
    thicknessOptionsMm: [50, 80, 100, 120, 150, 200],
    uModel: { lambdaWmK: 0.045, surfaceR: 0, extraR: 0 },
  },
  {
    id: 'insul_minwool_80',
    kind: 'insulation',
    construction: 'утеплитель',
    material: 'Минеральная вата ~80 кг/м³',
    description: 'Открытый/вентилируемый фасад.',
    thicknessOptionsMm: [50, 80, 100, 120, 150, 200],
    uModel: { lambdaWmK: 0.041, surfaceR: 0, extraR: 0 },
  },
  {
    id: 'insul_minwool_100',
    kind: 'insulation',
    construction: 'утеплитель',
    material: 'Минеральная вата ~100 кг/м³',
    description: 'Открытый/вентилируемый фасад.',
    thicknessOptionsMm: [50, 80, 100, 120, 150, 200],
    uModel: { lambdaWmK: 0.039, surfaceR: 0, extraR: 0 },
  },
  {
    id: 'insul_minwool_150',
    kind: 'insulation',
    construction: 'утеплитель',
    material: 'Минеральная вата ~150 кг/м³',
    description: 'Открытый/вентилируемый фасад.',
    thicknessOptionsMm: [50, 80, 100, 120, 150, 200],
    uModel: { lambdaWmK: 0.038, surfaceR: 0, extraR: 0 },
  },
  {
    id: 'window_pvc_double_chamber_3_glass',
    kind: 'window',
    construction: 'окно',
    material: 'ПВХ двухкамерное (3 стекла)',
    description: 'Стандартное ПВХ-окно: 2 камеры/3 стекла.',
    uValue: 1.1,
  },
  {
    id: 'window_pvc_triple_chamber_4_glass',
    kind: 'window',
    construction: 'окно',
    material: 'ПВХ трехкамерный (4 стекла)',
    description: 'ПВХ-окно повышенной энергоэффективности: 3 камеры/4 стекла.',
    uValue: 0.85,
  },
  {
    id: 'ceiling_concrete_insulated',
    kind: 'ceiling',
    construction: 'потолок',
    material: 'бетон + утеплитель',
    description: 'Потолок/перекрытие с утеплением (ориентировочный U).',
    uValue: 0.18,
  },
  {
    id: 'roof_concrete_insulated_flat',
    kind: 'roof',
    construction: 'совмещенное покрытие',
    material: 'ж/б плита + утеплитель',
    description: 'Бесчердачное покрытие (ориентир U: 0.15–0.18).',
    uValue: 0.16,
  },
  {
    id: 'floor_concrete_uninsulated',
    kind: 'floor',
    construction: 'пол',
    material: 'бетон без утепления',
    description: 'Пол без утепления — высокий U (большие потери).',
    uValue: 0.6,
  },
  {
    id: 'floor_slab_rough_screed_eps_finish_screed_porcelain',
    kind: 'floor',
    construction: 'пол',
    material:
      'бетонная плита + черновая стяжка + ЭППС + чистовая стяжка + керамогранит',
    uValue: 0.35,
    description:
      'Ориентир U при типовой толщине ЭППС: фактический U зависит от толщины утеплителя и узлов.',
  },
];

/** Дефолтный пресет окна (есть и во фолбэке, и в backend). */
export const DEFAULT_WINDOW_PRESET_ID = 'window_pvc_double_chamber_3_glass';
