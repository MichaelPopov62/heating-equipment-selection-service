/**
 * Назначение: Fallback карточек режимов ТП (если GET /modes недоступен).
 */

import type { UfhModePresetCard } from '../types/ufhModePreset';

export const FALLBACK_UFH_MODE_PRESETS: UfhModePresetCard[] = [
  {
    presetId: 'ufh_mixed_radiators',
    ui: {
      title: 'Тёплый пол + радиаторы',
      badge: 'Смешанная система',
      description:
        'ТП в выбранных комнатах (контур по финишу: 45/35 для плитки, 40/30 для ламината), остальное — радиаторы. Мощность радиатора уменьшается на отдачу пола.',
    },
  },
  {
    presetId: 'ufh_only',
    ui: {
      title: 'Отопление только теплым полом',
      badge: 'Современный дом',
      description:
        'Без радиаторов — котёл работает на низкотемпературный контур пола. Экономия на радиаторах и трубах, равномерный комфорт.',
    },
  },
];
