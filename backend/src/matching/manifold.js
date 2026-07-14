/**
 * Назначение: підбір колекторів з каталогу для смети.
 * Опис: ТП/радіаторні (manifolds) і котельні (boilerManifolds) за числом контурів,
 * призначенням і потужністю; відмінності house / apartment.
 */

import { logger } from '../utils/logger.js';

/** Макс. петель ТП на один колекторний вузол (бізнес-ліміт, не max каталогу). */
export const UFH_MANIFOLD_MAX_OUTLETS_PER_NODE = 12;

/** Критичний внутрішній збій підбору колекторів. */
export const MANIFOLD_FAILURE_CODE_INTERNAL = /** @type {const} */ ('MANIFOLD_INTERNAL');

/** Критичний збій через некоректні вхідні дані. */
export const MANIFOLD_FAILURE_CODE_INPUT = /** @type {const} */ ('MANIFOLD_INPUT_INVALID');

/**
 * Порожній звіт колекторів при soft-fail (ok: false).
 * Інваріант: underfloor=[], radiator/boilerManifold=null — унібокси не бачать каскад.
 *
 * @param {object} args
 * @param {import('../types/shared-types.js').ManifoldsMatchingFailureCode} args.failureCode
 * @param {string} args.message - людськочитабельний підсумок для warnings
 * @param {string} [args.causeMessage] - коротка причина без stack
 * @returns {import('../types/shared-types.js').ManifoldsMatchingReport}
 */
export function buildEmptyManifoldsFailure({ failureCode, message, causeMessage }) {
  const code =
    failureCode === MANIFOLD_FAILURE_CODE_INPUT
      ? MANIFOLD_FAILURE_CODE_INPUT
      : MANIFOLD_FAILURE_CODE_INTERNAL;
  const summary =
    typeof message === 'string' && message.trim()
      ? message.trim()
      : 'Смета коллекторов пуста; расчёт унибоксов и гидравлики продолжается.';
  /** @type {string[]} */
  const warnings = [`Коллекторы: подбор не выполнен (${code}). ${summary}`];
  if (typeof causeMessage === 'string' && causeMessage.trim()) {
    warnings.push(`Причина: ${causeMessage.trim()}`);
  }
  return {
    ok: false,
    failureCode: code,
    underfloor: [],
    radiator: null,
    boilerManifold: null,
    warnings,
  };
}

/**
 * Штатний звіт колекторів (ok: true). Дефіцит SKU (selected=null) — не soft-fail.
 *
 * @param {object} args
 * @param {import('../types/shared-types.js').ManifoldUnderfloorPick[]} args.underfloor
 * @param {import('../types/shared-types.js').ManifoldRadiatorPick | null} args.radiator
 * @param {import('../types/shared-types.js').BoilerManifoldPick | null} args.boilerManifold
 * @param {string[]} args.warnings
 * @returns {import('../types/shared-types.js').ManifoldsMatchingReport}
 */
export function buildOkManifoldsReport({
  underfloor = [],
  radiator = null,
  boilerManifold = null,
  warnings = [],
}) {
  return {
    ok: true,
    underfloor,
    radiator,
    boilerManifold,
    warnings,
  };
}

/**
 * Обгортка core→звіт з catch (для verify ін'єкції throw без публічного _testThrow).
 *
 * @param {(args: object) => import('../types/shared-types.js').ManifoldsMatchingReport} core
 * @param {object} [args]
 * @returns {import('../types/shared-types.js').ManifoldsMatchingReport}
 */
export function pickManifoldsWithCore(core, args = {}) {
  try {
    return core(args);
  } catch (err) {
    const known =
      err && typeof err === 'object'
        ? /** @type {import('../types/shared-types.js').AppErrorLike & { message?: string }} */ (err)
        : null;
    const failureCode =
      known?.code === MANIFOLD_FAILURE_CODE_INPUT
        ? MANIFOLD_FAILURE_CODE_INPUT
        : MANIFOLD_FAILURE_CODE_INTERNAL;
    const errMessage = known?.message ? String(known.message) : null;
    logger.warn('matching.manifold.fail', null, {
      code: failureCode,
      message: errMessage,
    }, err);
    return buildEmptyManifoldsFailure({
      failureCode,
      message:
        'Смета коллекторов пуста; расчёт унибоксов и гидравлики продолжается.',
      ...(errMessage ? { causeMessage: errMessage } : {}),
    });
  }
}

/**
 * Рівномірний поділ петель на частини ≤ maxPerNode (каскад колекторів).
 * Приклади: 14 → [7,7]; 13 → [7,6]; 25 → [9,8,8].
 *
 * @param {number} total
 * @param {number} [maxPerNode=UFH_MANIFOLD_MAX_OUTLETS_PER_NODE]
 * @returns {number[]}
 */
export function splitOutletsForCascade(
  total,
  maxPerNode = UFH_MANIFOLD_MAX_OUTLETS_PER_NODE,
) {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  const max = Math.max(1, Math.floor(Number(maxPerNode) || UFH_MANIFOLD_MAX_OUTLETS_PER_NODE));
  if (n <= 0) return [];
  if (n <= max) return [n];

  const units = Math.ceil(n / max);
  const base = Math.floor(n / units);
  const rem = n % units;
  /** @type {number[]} */
  const parts = [];
  for (let i = 0; i < units; i += 1) {
    parts.push(base + (i < rem ? 1 : 0));
  }
  return parts;
}

/**
 * Текст попередження про автокаскад ТП-колекторів.
 *
 * @param {number} unitCount
 * @param {number[]} parts
 * @returns {string}
 */
function buildUfhCascadeWarning(unitCount, parts) {
  const splitLabel = parts.join('+');
  return (
    `Превышен лимит петель на один узел (max ${UFH_MANIFOLD_MAX_OUTLETS_PER_NODE}). `
    + `Система автоматически разделена на ${unitCount} коллектора (${splitLabel}).`
  );
}

/**
 * Підбір розподільного колектора (ТП або радіатори).
 *
 * @param {object} args
 * @param {import('../catalog/types.js').NormalizedCatalog | undefined} args.catalog
 * @param {'radiator' | 'underfloor'} args.application
 * @param {number} args.requiredOutlets
 * @returns {{
 *   selected: import('../catalog/types.js').ManifoldCatalogItemNormalized | null,
 *   warnings: string[],
 * }}
 */
export function pickDistributionManifold({ catalog, application, requiredOutlets }) {
  const need = Math.max(0, Math.floor(Number(requiredOutlets) || 0));
  /** @type {import('../catalog/types.js').ManifoldCatalogItemNormalized[]} */
  const pool = (catalog?.manifolds ?? []).filter(
    (m) => m.manifoldApplication === application,
  );

  if (need <= 0) {
    return { selected: null, warnings: [] };
  }

  if (!pool.length) {
    logger.warn('matching.manifold.emptyCatalog', null, { application, requiredOutlets: need });
    return {
      selected: null,
      warnings: [
        application === 'underfloor'
          ? 'В каталоге нет коллекторов для тёплого пола.'
          : 'В каталоге нет коллекторов для радиаторного контура.',
      ],
    };
  }

  /** @type {import('../catalog/types.js').ManifoldCatalogItemNormalized[]} */
  const fitting = pool.filter((m) => m.outletsCount >= need);
  /** @type {string[]} */
  const warnings = [];

  if (fitting.length) {
    fitting.sort((a, b) => {
      if (application === 'underfloor' && a.hasFlowMeters !== b.hasFlowMeters) {
        return a.hasFlowMeters ? -1 : 1;
      }
      if (a.outletsCount !== b.outletsCount) return a.outletsCount - b.outletsCount;
      return a.price - b.price;
    });
    return { selected: fitting[0] ?? null, warnings };
  }

  const fallback = [...pool].sort((a, b) => {
    if (b.outletsCount !== a.outletsCount) return b.outletsCount - a.outletsCount;
    return a.price - b.price;
  })[0];
  if (!fallback) {
    return { selected: null, warnings: ['В каталоге нет подходящих коллекторов.'] };
  }
  warnings.push(
    `Подобран коллектор ${fallback.model} (${fallback.outletsCount} вых.) при потребности ${need} — ограничение каталога.`,
  );
  return { selected: fallback, warnings };
}

/**
 * @param {object} args
 * @param {import('../catalog/types.js').NormalizedCatalog | undefined} args.catalog
 * @param {number} args.requiredCircuits
 * @param {number} args.requiredPowerKw
 * @returns {{
 *   selected: import('../catalog/types.js').BoilerManifoldCatalogItemNormalized | null,
 *   warnings: string[],
 * }}
 */
export function pickBoilerManifold({ catalog, requiredCircuits, requiredPowerKw }) {
  const needCircuits = Math.max(0, Math.floor(Number(requiredCircuits) || 0));
  const needKw = Math.max(0, Number(requiredPowerKw) || 0);
  /** @type {import('../catalog/types.js').BoilerManifoldCatalogItemNormalized[]} */
  const pool = catalog?.boilerManifolds ?? [];

  if (needCircuits <= 0) {
    return { selected: null, warnings: [] };
  }

  if (!pool.length) {
    logger.warn('matching.boilerManifold.emptyCatalog', null, {
      requiredCircuits: needCircuits,
      requiredPowerKw: needKw,
    });
    return {
      selected: null,
      warnings: ['В каталоге нет котельных коллекторов.'],
    };
  }

  /** @type {import('../catalog/types.js').BoilerManifoldCatalogItemNormalized[]} */
  const fitting = pool.filter(
    (m) => m.circuitsCount >= needCircuits && m.maxPowerKw >= needKw,
  );
  /** @type {string[]} */
  const warnings = [];

  if (fitting.length) {
    fitting.sort((a, b) => {
      if (a.circuitsCount !== b.circuitsCount) return a.circuitsCount - b.circuitsCount;
      if (a.maxPowerKw !== b.maxPowerKw) return a.maxPowerKw - b.maxPowerKw;
      return a.price - b.price;
    });
    return { selected: fitting[0] ?? null, warnings };
  }

  const fallback = [...pool].sort((a, b) => {
    if (b.circuitsCount !== a.circuitsCount) return b.circuitsCount - a.circuitsCount;
    if (b.maxPowerKw !== a.maxPowerKw) return b.maxPowerKw - a.maxPowerKw;
    return a.price - b.price;
  })[0];
  if (!fallback) {
    return { selected: null, warnings: ['В каталоге нет подходящих котельных коллекторов.'] };
  }

  /** @type {string[]} */
  const parts = [];
  if (fallback.circuitsCount < needCircuits) {
    parts.push(`контуров ${fallback.circuitsCount} < ${needCircuits}`);
  }
  if (fallback.maxPowerKw < needKw) {
    parts.push(`макс. ${fallback.maxPowerKw} кВт < ${needKw} кВт`);
  }
  logger.warn('matching.boilerManifold.fallbackApplied', null, {
    requestedCircuits: needCircuits,
    requestedPowerKw: needKw,
    selectedModel: fallback.model,
    selectedCircuits: fallback.circuitsCount,
    selectedPowerKw: fallback.maxPowerKw,
    deficits: parts,
  });
  warnings.push(
    `Подобран котельный коллектор ${fallback.model} с дефицитом (${parts.join('; ') || 'ограничение каталога'}).`,
  );
  return { selected: fallback, warnings };
}

/**
 * @param {import('../types/shared-types.js').BuildingInput | undefined} building
 * @returns {Map<string, number>}
 */
function roomFloorById(building) {
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const room of building?.rooms ?? []) {
    if (room?.id) map.set(room.id, Number(room.floor) || 1);
  }
  return map;
}

/**
 * Число петель ТП у кімнаті звіту.
 * @param {import('../types/shared-types.js').UnderfloorHeatingRoomReport} room
 * @returns {number}
 */
function roomLoopsCount(room) {
  if (typeof room.loopsCount === 'number' && room.loopsCount > 0) {
    return Math.floor(room.loopsCount);
  }
  if (Array.isArray(room.loops) && room.loops.length > 0) {
    return room.loops.length;
  }
  return 0;
}

/**
 * @param {import('../types/shared-types.js').UnderfloorHeatingReport | null | undefined} underfloorHeating
 * @param {import('../types/shared-types.js').BuildingInput | undefined} building
 * @returns {Map<number, number>}
 */
/**
 * Терминал петли комнаты ТП (из отчёта или анкеты building).
 * @param {import('../types/shared-types.js').UnderfloorHeatingRoomReport} room
 * @param {import('../types/shared-types.js').BuildingInput | undefined} building
 * @returns {'collector' | 'unibox'}
 */
function roomUfhTerminalControl(room, building) {
  if (room.ufhTerminalControl === 'unibox') return 'unibox';
  if (room.ufhTerminalControl === 'collector') return 'collector';
  const id = String(room.roomId ?? '');
  for (const r of building?.rooms ?? []) {
    if (String(r?.id) !== id) continue;
    if (r.underfloorHeating?.ufhTerminalControl === 'unibox') return 'unibox';
    break;
  }
  return 'collector';
}

/**
 * @param {import('../types/shared-types.js').UnderfloorHeatingReport | null | undefined} underfloorHeating
 * @param {import('../types/shared-types.js').BuildingInput | undefined} building
 * @returns {Map<number, number>}
 */
function underfloorOutletsByFloor(underfloorHeating, building) {
  /** @type {Map<number, number>} */
  const byFloor = new Map();
  const floors = roomFloorById(building);
  for (const room of underfloorHeating?.rooms ?? []) {
    if (roomUfhTerminalControl(room, building) === 'unibox') continue;
    const loops = roomLoopsCount(room);
    if (loops <= 0) continue;
    const floor = floors.get(room.roomId) ?? 1;
    byFloor.set(floor, (byFloor.get(floor) ?? 0) + loops);
  }
  return byFloor;
}

/**
 * @param {import('../types/shared-types.js').RadiatorsMatchingReport | undefined} radiators
 * @returns {number}
 */
function radiatorOutletNeed(radiators) {
  let n = 0;
  for (const row of radiators?.byRoom ?? []) {
    if ((row.radiatorDesignWatts ?? 0) > 0) n += 1;
  }
  return n;
}

/**
 * Чи потрібен котельний колектор (лише house).
 * @param {object} args
 * @param {'apartment' | 'house'} args.objectType
 * @param {import('../types/shared-types.js').UfhDistributionPreset | undefined} args.distributionPreset
 * @param {boolean} args.hasRadiatorZone
 * @param {boolean} args.hasUfhZone
 * @returns {boolean}
 */
function needsBoilerManifold({
  objectType,
  distributionPreset,
  hasRadiatorZone,
  hasUfhZone,
}) {
  if (objectType !== 'house') return false;
  if (distributionPreset === 'hydraulic_separator') return true;
  return hasRadiatorZone && hasUfhZone;
}

/**
 * Ядро підбору колекторів (без catch). При критичній помилці може кинути;
 * публічний pickManifolds завжди ловить і повертає ok: false.
 *
 * @param {object} args
 * @param {import('../catalog/types.js').NormalizedCatalog} [args.catalog]
 * @param {import('../types/shared-types.js').BuildingInput | undefined} [args.building]
 * @param {import('../types/shared-types.js').UnderfloorHeatingReport | null | undefined} [args.underfloorHeating]
 * @param {import('../types/shared-types.js').RadiatorsMatchingReport | undefined} [args.radiators]
 * @param {import('../types/shared-types.js').BoilerMatchingReport | undefined} [args.boiler]
 * @param {import('../types/shared-types.js').HydraulicsSurveyInput | undefined} [args.hydraulics]
 * @returns {import('../types/shared-types.js').ManifoldsMatchingReport}
 */
export function pickManifoldsCore({
  catalog,
  building,
  underfloorHeating = null,
  radiators,
  boiler,
  hydraulics,
} = {}) {
  const objectMetaType = building?.objectMeta?.objectType;
  const objectType =
    objectMetaType === 'apartment' || objectMetaType === 'house'
      ? objectMetaType
      : 'house';

  /** @type {string[]} */
  const warnings = [];

  logger.info('matching.manifold.start', null, {
    objectType,
    distributionPreset: underfloorHeating?.distributionPreset ?? null,
    wiring: hydraulics?.radiatorWiringSystemType ?? null,
  });

  /** @type {import('../types/shared-types.js').ManifoldUnderfloorPick[]} */
  const underfloor = [];
  const outletsByFloor = underfloorOutletsByFloor(underfloorHeating, building);
  for (const floor of [...outletsByFloor.keys()].sort((a, b) => a - b)) {
    const requiredOutlets = outletsByFloor.get(floor) ?? 0;
    const parts = splitOutletsForCascade(requiredOutlets);
    /** @type {import('../types/shared-types.js').ManifoldUnderfloorUnitPick[]} */
    const units = [];
    /** @type {string[]} */
    const floorWarnings = [];

    if (parts.length > 1) {
      const cascadeMsg = buildUfhCascadeWarning(parts.length, parts);
      floorWarnings.push(cascadeMsg);
      warnings.push(cascadeMsg);
    }

    for (let i = 0; i < parts.length; i += 1) {
      const partNeed = parts[i];
      if (partNeed == null) continue;
      const pick = pickDistributionManifold({
        catalog,
        application: 'underfloor',
        requiredOutlets: partNeed,
      });
      floorWarnings.push(...pick.warnings);
      warnings.push(...pick.warnings);
      units.push({
        index: i + 1,
        requiredOutlets: partNeed,
        selected: pick.selected,
        warnings: pick.warnings,
      });
    }

    underfloor.push({
      floor,
      requiredOutlets,
      units,
      warnings: floorWarnings,
    });
  }

  /** @type {import('../types/shared-types.js').ManifoldRadiatorPick | null} */
  let radiator = null;
  if (hydraulics?.radiatorWiringSystemType === 'manifold') {
    const requiredOutlets = radiatorOutletNeed(radiators);
    const pick = pickDistributionManifold({
      catalog,
      application: 'radiator',
      requiredOutlets,
    });
    warnings.push(...pick.warnings);
    radiator = {
      requiredOutlets,
      selected: pick.selected,
      warnings: pick.warnings,
    };
  }

  const hasRadiatorZone = radiatorOutletNeed(radiators) > 0;
  const hasUfhZone = outletsByFloor.size > 0;
  const distributionPreset = underfloorHeating?.distributionPreset;
  const wantBoiler = needsBoilerManifold({
    objectType,
    distributionPreset,
    hasRadiatorZone,
    hasUfhZone,
  });

  /** @type {import('../types/shared-types.js').BoilerManifoldPick | null} */
  let boilerManifold = null;
  if (wantBoiler) {
    const requiredCircuits = (hasRadiatorZone ? 1 : 0) + (hasUfhZone ? 1 : 0);
    const requiredPowerKw = Number(boiler?.requiredKw) || 0;
    const pick = pickBoilerManifold({
      catalog,
      requiredCircuits: Math.max(requiredCircuits, 1),
      requiredPowerKw,
    });
    warnings.push(...pick.warnings);
    boilerManifold = {
      requiredCircuits: Math.max(requiredCircuits, 1),
      requiredPowerKw,
      selected: pick.selected,
      warnings: pick.warnings,
    };
  }

  logger.info('matching.manifold.done', null, {
    ok: true,
    underfloorFloors: underfloor.length,
    underfloorUnits: underfloor.reduce((s, f) => s + f.units.length, 0),
    radiatorSelected: radiator?.selected?.model ?? null,
    boilerManifoldSelected: boilerManifold?.selected?.model ?? null,
    warnings: warnings.length,
  });

  return buildOkManifoldsReport({
    underfloor,
    radiator,
    boilerManifold,
    warnings,
  });
}

/**
 * Оркестратор підбору колекторів після резолву distributionPreset ТП.
 * Ніколи не кидає назовні: критичний збій → ok: false + порожні структури.
 *
 * @param {object} [args]
 * @param {import('../catalog/types.js').NormalizedCatalog} [args.catalog]
 * @param {import('../types/shared-types.js').BuildingInput | undefined} [args.building]
 * @param {import('../types/shared-types.js').UnderfloorHeatingReport | null | undefined} [args.underfloorHeating]
 * @param {import('../types/shared-types.js').RadiatorsMatchingReport | undefined} [args.radiators]
 * @param {import('../types/shared-types.js').BoilerMatchingReport | undefined} [args.boiler]
 * @param {import('../types/shared-types.js').HydraulicsSurveyInput | undefined} [args.hydraulics]
 * @returns {import('../types/shared-types.js').ManifoldsMatchingReport}
 */
export function pickManifolds(args = {}) {
  return pickManifoldsWithCore(pickManifoldsCore, args);
}
