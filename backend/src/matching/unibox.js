/**
 * Назначение: підбір унібоксів з каталогу для смети.
 * Опис: по одній позиції на петлю ТП (≤2 петель); фільтр за всіма паспортними числами.
 */

import { logger } from '../utils/logger.js';

/**
 * @typedef {import('../catalog/types').UniboxCatalogItemNormalized} UniboxCatalogItemNormalized
 * @typedef {import('../types/shared-types').UniboxLoopDemand} UniboxLoopDemand
 * @typedef {import('../types/shared-types').UniboxesMatchingReport} UniboxesMatchingReport
 */

/** Розрахунковий робочий тиск закритої системи опалення, бар (PN-перевірка паспорта). */
export const UNIBOX_DESIGN_PRESSURE_BAR = 3;

/** Макс. Δp на клапані унібокса для оцінки мін. Kv, бар. */
export const UNIBOX_VALVE_MAX_DP_BAR = 0.25;

/** Унібокс — локальний регулятор; при >2 петель ТП — лише колекторна схема. */
export const UNIBOX_MAX_LOOPS_FOR_MATCHING = 2;

/** Підключення петлі ТП (PEX) у цьому сервісі — євроконус. */
export const UNIBOX_REQUIRED_FIT = /** @type {const} */ ('eurocone');

/**
 * Мін. Kv (м³/ч) для витрати петлі при допустимому Δp на клапані.
 *
 * @param {number} flowLph
 * @param {number} [maxDpBar=UNIBOX_VALVE_MAX_DP_BAR]
 * @returns {number}
 */
export function minKvM3hForFlowLph(flowLph, maxDpBar = UNIBOX_VALVE_MAX_DP_BAR) {
  const q = Math.max(0, Number(flowLph) || 0) / 1000;
  const dp = Math.max(0.01, Number(maxDpBar) || UNIBOX_VALVE_MAX_DP_BAR);
  return q / Math.sqrt(dp);
}

/**
 * @param {UniboxCatalogItemNormalized['type']} type
 * @returns {number}
 */
function uniboxTypeRank(type) {
  switch (type) {
    case 'rtl_air':
      return 0;
    case 'rtl_afc':
      return 1;
    case 'rtl':
      return 2;
    case 'balancing_valve':
      return 3;
    case 'air_only':
      return 4;
    default:
      return 9;
  }
}

/**
 * Чи підходить унібокс під потребу петлі за всіма наявними паспортними полями.
 *
 * @param {UniboxCatalogItemNormalized} unibox
 * @param {UniboxLoopDemand} demand
 * @returns {boolean}
 */
export function uniboxFitsDemand(unibox, demand) {
  if (unibox.loopsCount < 1) return false;
  if (unibox.maxAreaSqM < demand.areaSqM) return false;
  if (unibox.maxLoopLengthM < demand.loopLengthM) return false;
  if (demand.loopLengthM <= 0) return false;
  if (unibox.maxTemperatureC < demand.circuitSupplyC) return false;

  if (unibox.maxPressureBar < demand.systemPressureBar) return false;

  if (unibox.kvM3h < demand.minKvM3h) return false;

  if (unibox.connection?.fit !== demand.requiredFit) return false;

  if (typeof unibox.maxSupplyTempC === 'number') {
    if (demand.circuitSupplyC > unibox.maxSupplyTempC) return false;
  }

  if (
    typeof unibox.minCoolantTempC === 'number' &&
    typeof unibox.maxCoolantTempC === 'number'
  ) {
    if (
      demand.circuitReturnC < unibox.minCoolantTempC ||
      demand.circuitReturnC > unibox.maxCoolantTempC
    ) {
      return false;
    }
  }

  if (
    typeof unibox.minAirTempC === 'number' &&
    typeof unibox.maxAirTempC === 'number'
  ) {
    if (
      demand.roomAirTempC < unibox.minAirTempC ||
      demand.roomAirTempC > unibox.maxAirTempC
    ) {
      return false;
    }
  }

  if (typeof unibox.minFlowLph === 'number' && typeof unibox.maxFlowLph === 'number') {
    if (demand.flowLph < unibox.minFlowLph || demand.flowLph > unibox.maxFlowLph) {
      return false;
    }
  }

  return true;
}

/**
 * @param {UniboxCatalogItemNormalized[]} pool
 * @param {UniboxLoopDemand} demand
 * @returns {UniboxCatalogItemNormalized | null}
 */
export function pickUniboxForDemand(pool, demand) {
  const fitting = pool.filter((unibox) => uniboxFitsDemand(unibox, demand));
  if (!fitting.length) return null;
  fitting.sort((a, b) => {
    const rankDiff = uniboxTypeRank(a.type) - uniboxTypeRank(b.type);
    if (rankDiff !== 0) return rankDiff;
    // Пріоритет G3/4 (типовий євроконус 16×2) над G1/2.
    const threadScore = (u) => (u.connection?.thread === 'G3/4' ? 0 : 1);
    const th = threadScore(a) - threadScore(b);
    if (th !== 0) return th;
    return a.price - b.price;
  });
  return fitting[0];
}

/**
 * Збирає потреби лише з реальних петель (loopLengthM > 0). Без fallback loopLengthM=0.
 *
 * @param {import('../types/shared-types').UnderfloorHeatingReport | null | undefined} underfloorHeating
 * @param {object} ctx
 * @param {number} ctx.roomAirTempC
 * @param {number} [ctx.systemPressureBar]
 * @returns {Array<{ roomId: string, loopId: string, required: UniboxLoopDemand }>}
 */
export function collectUniboxLoopDemands(underfloorHeating, ctx) {
  const roomAirTempC = Number(ctx.roomAirTempC);
  const systemPressureBar =
    typeof ctx.systemPressureBar === 'number' && Number.isFinite(ctx.systemPressureBar)
      ? ctx.systemPressureBar
      : UNIBOX_DESIGN_PRESSURE_BAR;

  /** @type {Array<{ roomId: string, loopId: string, required: UniboxLoopDemand }>} */
  const out = [];
  if (!Number.isFinite(roomAirTempC)) return out;

  for (const room of underfloorHeating?.rooms ?? []) {
    const areaSqM = Number(room.heatedAreaM2 ?? room.areaM2) || 0;
    const supplyC = Number(room.circuitSupplyC);
    const returnC = Number(room.circuitReturnC);
    if (!Number.isFinite(supplyC) || !Number.isFinite(returnC)) continue;

    const loops = Array.isArray(room.loops) ? room.loops : [];
    for (const loop of loops) {
      const loopLengthM = Number(loop.loopLengthM) || 0;
      if (loopLengthM <= 0) continue;
      const flowM3h = Number(loop.flowRateM3PerHour) || 0;
      const flowLph = flowM3h * 1000;
      out.push({
        roomId: room.roomId,
        loopId: String(loop.loopId || `${room.roomId}-loop`),
        required: {
          areaSqM,
          loopLengthM,
          circuitSupplyC: supplyC,
          circuitReturnC: returnC,
          flowLph,
          roomAirTempC,
          systemPressureBar,
          minKvM3h: minKvM3hForFlowLph(flowLph),
          requiredFit: UNIBOX_REQUIRED_FIT,
        },
      });
    }
  }
  return out;
}

/**
 * Чи є каскад ТП-колекторів (units > 1 на поверсі) — унібокси не підбираємо.
 *
 * @param {import('../types/shared-types').ManifoldsMatchingReport | null | undefined} manifolds
 * @returns {boolean}
 */
export function hasUnderfloorManifoldCascade(manifolds) {
  for (const floor of manifolds?.underfloor ?? []) {
    if ((floor.units?.length ?? 0) > 1) return true;
  }
  return false;
}

/**
 * Оркестратор підбору унібоксів після pickManifolds, до гідравліки.
 *
 * @param {object} args
 * @param {import('../catalog/types').NormalizedCatalog | undefined} args.catalog
 * @param {import('../types/shared-types').UnderfloorHeatingReport | null | undefined} args.underfloorHeating
 * @param {number | undefined} args.roomAirTempC — temps.insideC
 * @param {number | undefined} [args.systemPressureBar]
 * @param {import('../types/shared-types').ManifoldsMatchingReport | null | undefined} [args.manifolds]
 * @returns {UniboxesMatchingReport}
 */
export function pickUniboxes({
  catalog,
  underfloorHeating = null,
  roomAirTempC,
  systemPressureBar,
  manifolds = null,
} = {}) {
  /** @type {UniboxCatalogItemNormalized[]} */
  const pool = catalog?.uniboxes ?? [];
  /** @type {string[]} */
  const warnings = [];

  const air = Number(roomAirTempC);
  if (!Number.isFinite(air)) {
    logger.info('matching.unibox.skip', null, { reason: 'no_room_air_temp' });
    return { byLoop: [], warnings: [] };
  }

  const demands = collectUniboxLoopDemands(underfloorHeating, {
    roomAirTempC: air,
    systemPressureBar,
  });

  logger.info('matching.unibox.start', null, {
    catalogCount: pool.length,
    loopDemands: demands.length,
    roomAirTempC: air,
  });

  if (!demands.length) {
    logger.info('matching.unibox.done', null, { byLoop: 0, warnings: 0 });
    return { byLoop: [], warnings: [] };
  }

  if (hasUnderfloorManifoldCascade(manifolds)) {
    const msg =
      'Унибоксы не подбираются: каскад коллекторов ТП (units > 1) — управление через коллектор.';
    warnings.push(msg);
    logger.info('matching.unibox.skip', null, { reason: 'manifold_cascade' });
    return { byLoop: [], warnings };
  }

  if (demands.length > UNIBOX_MAX_LOOPS_FOR_MATCHING) {
    const msg =
      `Унибоксы не подбираются: ${demands.length} петель ТП (лимит ${UNIBOX_MAX_LOOPS_FOR_MATCHING}) — используйте коллекторную схему.`;
    warnings.push(msg);
    logger.info('matching.unibox.skip', null, {
      reason: 'too_many_loops',
      loopDemands: demands.length,
    });
    return { byLoop: [], warnings };
  }

  if (!pool.length) {
    warnings.push('В каталоге нет унибоксов для подбора петель тёплого пола.');
    const byLoop = demands.map((d) => ({
      roomId: d.roomId,
      loopId: d.loopId,
      required: d.required,
      selected: null,
      warnings: ['Нет позиций unibox в каталоге.'],
    }));
    logger.warn('matching.unibox.emptyCatalog', null, { loopDemands: demands.length });
    return { byLoop, warnings };
  }

  /** @type {import('../types/shared-types').UniboxLoopPick[]} */
  const byLoop = [];

  for (const demand of demands) {
    /** @type {string[]} */
    const rowWarnings = [];
    const selected = pickUniboxForDemand(pool, demand.required);
    if (!selected) {
      const msg =
        `Нет унибокса под петлю ${demand.loopId} (площадь ${demand.required.areaSqM} м², ` +
        `длина ${demand.required.loopLengthM} м, подача ${demand.required.circuitSupplyC} °C, ` +
        `обратка ${demand.required.circuitReturnC} °C, воздух ${demand.required.roomAirTempC} °C, ` +
        `расход ${demand.required.flowLph} л/ч, P≥${demand.required.systemPressureBar} бар, ` +
        `Kv≥${demand.required.minKvM3h.toFixed(3)}, fit=${demand.required.requiredFit}).`;
      rowWarnings.push(msg);
      warnings.push(msg);
    }
    byLoop.push({
      roomId: demand.roomId,
      loopId: demand.loopId,
      required: demand.required,
      selected,
      warnings: rowWarnings,
    });
  }

  logger.info('matching.unibox.done', null, {
    byLoop: byLoop.length,
    selected: byLoop.filter((r) => r.selected).length,
    warnings: warnings.length,
  });

  return { byLoop, warnings };
}
