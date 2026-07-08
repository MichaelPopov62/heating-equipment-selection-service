/**
 * Назначение: идентификаторы устаревших пресетов (compat-слой черновиков).
 * Описание: Используются в migrateLegacyExternalWalls и filterStructuralWallPresets.
 */

/** Устаревшие комбинированные пресеты «стена + ППС» — не показывать в UI, мигрировать при загрузке. */
export const LEGACY_COMBINED_WALL_PRESET_IDS = new Set(['wall_pps_50', 'wall_pps_100']);
