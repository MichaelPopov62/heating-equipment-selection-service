/**
 * Назначение: Fallback карточек режимов ТП (если GET /modes недоступен).
 */

import type { UfhModePresetCard } from '../types/ufhModePreset';

export const FALLBACK_UFH_MODE_PRESETS: UfhModePresetCard[] = [
  {
    presetId: 'ufh_mixed_radiators',
    ui: {
      title: 'Тепла підлога + радіатори',
      badge: 'Змішана система',
      description:
        'ТП у вибраних кімнатах (контур за фінішем: 45/35 для плитки, 40/30 для ламінату), решта — радіатори. Потужність радіатора зменшується на віддачу підлоги.',
    },
  },
  {
    presetId: 'ufh_only',
    ui: {
      title: 'Опалення лише теплою підлогою',
      badge: 'Сучасний будинок',
      description:
        'Без радіаторів — котел працює на низькотемпературний контур підлоги. Економія на радіаторах і трубах, рівномірний комфорт.',
    },
  },
];
