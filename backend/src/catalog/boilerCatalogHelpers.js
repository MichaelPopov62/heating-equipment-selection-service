/**
 * Назначение: хелперы номенклатуры котлов в каталоге.
 * Описание: нормализация mountingType (поле или теги) — SSOT для validateCatalog и seed.
 */

import { sanitizeTrimAngleBrackets } from '../utils/sanitizeString.js';

/** Допустимые значения mountingType в каталоге (настенный / напольный). */
const BOILER_MOUNTING_WALL = 'wall';
const BOILER_MOUNTING_FLOOR = 'floor';

/**
 * Разбирает строку mountingType или тег (wall, floor, wall-mounted, floor-standing, настенный, напольный).
 *
 * @param {unknown} raw
 * @returns {'wall' | 'floor' | null}
 */
export function parseBoilerMountingTypeToken(raw) {
  const s = sanitizeTrimAngleBrackets(raw).toLowerCase().replace(/_/g, '-');
  if (!s) return null;
  if (s === 'wall' || s === 'wall-mounted' || s === 'настенный') return BOILER_MOUNTING_WALL;
  if (s === 'floor' || s === 'floor-standing' || s === 'напольный') return BOILER_MOUNTING_FLOOR;
  return null;
}

/**
 * @param {Record<string, unknown>} item
 * @returns {'wall' | 'floor' | null}
 */
export function inferBoilerMountingTypeFromTags(item) {
  if (!Array.isArray(item.tags)) return null;
  for (const tag of item.tags) {
    const mt = parseBoilerMountingTypeToken(tag);
    if (mt) return mt;
  }
  return null;
}

/**
 * Нормализует mountingType: явное поле или теги wall-mounted / floor-standing.
 *
 * @param {Record<string, unknown>} item
 * @param {string} ctx
 */
export function applyBoilerMountingType(item, ctx) {
  const explicit =
    item.mountingType != null && sanitizeTrimAngleBrackets(item.mountingType) !== '';
  const fromField = explicit ? parseBoilerMountingTypeToken(item.mountingType) : null;
  const fromTags = inferBoilerMountingTypeFromTags(item);

  if (fromField && fromTags && fromField !== fromTags) {
    throw new Error(
      `Каталог: mountingType="${fromField}" не совпадает с тегом (${fromTags}) (${ctx}).`,
    );
  }

  const resolved = fromField ?? fromTags;
  if (resolved) {
    item.mountingType = resolved;
    return;
  }

  if (explicit) {
    throw new Error(`Каталог: mountingType должен быть "wall" или "floor" (${ctx}).`);
  }
}
