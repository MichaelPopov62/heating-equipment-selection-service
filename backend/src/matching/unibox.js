/**
 * Назначение: підбір унібоксів з каталогу для смети.
 * Опис: по одній позиції на петлю ТП (≤2 петель); строгі нерівності за паспортом;
 * smart fallback T повітря за room.type (анкету не змінюємо).
 */

import { logger } from '../utils/logger.js';
import {
  resolveUniboxRoomAirTempC,
} from './internal/uniboxRoomAirPresets.js';

/**
 * @typedef {import('../catalog/types').UniboxCatalogItemNormalized} UniboxCatalogItemNormalized
 * @typedef {import('../types/shared-types').UniboxLoopDemand} UniboxLoopDemand
 * @typedef {import('../types/shared-types').UniboxesMatchingReport} UniboxesMatchingReport
 * @typedef {import('./internal/uniboxRoomAirPresets.js').UniboxRoomAirTempSource} UniboxRoomAirTempSource
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
 * Чи підходить унібокс під потребу петлі (строгі нерівності за паспортом).
 * Рівність на межі max/min паспорта → false.
 *
 * @param {UniboxCatalogItemNormalized} unibox
 * @param {UniboxLoopDemand} demand
 * @returns {boolean}
 */
export function uniboxFitsDemand(unibox, demand) {
  if (!(unibox.loopsCount >= 1)) return false;
  if (!(demand.loopLengthM > 0)) return false;
  if (!(demand.areaSqM < unibox.maxAreaSqM)) return false;
  if (!(demand.loopLengthM < unibox.maxLoopLengthM)) return false;
  if (!(demand.circuitSupplyC < unibox.maxTemperatureC)) return false;
  if (!(demand.systemPressureBar < unibox.maxPressureBar)) return false;
  if (!(demand.minKvM3h < unibox.kvM3h)) return false;
  if (unibox.connection?.fit !== demand.requiredFit) return false;

  if (typeof unibox.maxSupplyTempC === 'number') {
    if (!(demand.circuitSupplyC < unibox.maxSupplyTempC)) return false;
  }

  if (
    typeof unibox.minCoolantTempC === 'number' &&
    typeof unibox.maxCoolantTempC === 'number'
  ) {
    if (
      !(
        unibox.minCoolantTempC < demand.circuitReturnC &&
        demand.circuitReturnC < unibox.maxCoolantTempC
      )
    ) {
      return false;
    }
  }

  if (
    typeof unibox.minAirTempC === 'number' &&
    typeof unibox.maxAirTempC === 'number'
  ) {
    // roomAirTempC — лише T повітря приміщення (не теплоносій).
    if (
      !(
        unibox.minAirTempC < demand.roomAirTempC &&
        demand.roomAirTempC < unibox.maxAirTempC
      )
    ) {
      return false;
    }
  }

  if (typeof unibox.minFlowLph === 'number' && typeof unibox.maxFlowLph === 'number') {
    if (!(unibox.minFlowLph < demand.flowLph && demand.flowLph < unibox.maxFlowLph)) {
      return false;
    }
  }

  return true;
}

/**
 * Валідація demand петлі перед фільтром каталогу.
 *
 * @param {UniboxLoopDemand} demand
 * @param {{ roomId?: string, loopId?: string }} [meta]
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function validateUniboxLoopDemand(demand, meta = {}) {
  const roomId = meta.roomId ? String(meta.roomId) : '';
  const loopId = meta.loopId ? String(meta.loopId) : '';
  const loc = [roomId && `комната ${roomId}`, loopId && `петля ${loopId}`]
    .filter(Boolean)
    .join(', ');
  const prefix = loc ? `${loc}: ` : '';

  if (!(demand.loopLengthM > 0)) {
    return {
      ok: false,
      code: 'UNIBOX_LOOP_LENGTH',
      message: `${prefix}длина петли должна быть > 0 м (сейчас ${demand.loopLengthM}).`,
    };
  }
  if (!(demand.areaSqM > 0)) {
    return {
      ok: false,
      code: 'UNIBOX_AREA',
      message: `${prefix}площадь зоны должна быть > 0 м² (сейчас ${demand.areaSqM}).`,
    };
  }
  if (
    !Number.isFinite(demand.circuitSupplyC) ||
    !Number.isFinite(demand.circuitReturnC)
  ) {
    return {
      ok: false,
      code: 'UNIBOX_CIRCUIT_TEMP',
      message: `${prefix}температуры подачи/обратки контура ТП должны быть конечными числами.`,
    };
  }
  if (!(demand.circuitReturnC < demand.circuitSupplyC)) {
    return {
      ok: false,
      code: 'UNIBOX_DT',
      message:
        `${prefix}обратка теплоносителя (${demand.circuitReturnC} °C) должна быть < подачи ` +
        `(${demand.circuitSupplyC} °C).`,
    };
  }
  if (!(demand.flowLph > 0)) {
    return {
      ok: false,
      code: 'UNIBOX_FLOW',
      message: `${prefix}расход петли должен быть > 0 л/ч (сейчас ${demand.flowLph}).`,
    };
  }
  if (!Number.isFinite(demand.roomAirTempC)) {
    return {
      ok: false,
      code: 'UNIBOX_AIR_TEMP',
      message: `${prefix}расчётная T воздуха помещения (roomAirTempC) должна быть конечным числом.`,
    };
  }
  if (demand.requiredFit !== UNIBOX_REQUIRED_FIT) {
    return {
      ok: false,
      code: 'UNIBOX_FIT',
      message:
        `${prefix}для ТП PEX нужен fit=${UNIBOX_REQUIRED_FIT} ` +
        `(сейчас ${String(demand.requiredFit)}).`,
    };
  }
  return { ok: true };
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
 * @param {Array<{ id?: string, type?: string }> | null | undefined} rooms
 * @returns {Map<string, string>}
 */
function buildRoomTypeById(rooms) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const room of rooms ?? []) {
    const id = room?.id != null ? String(room.id) : '';
    if (!id) continue;
    map.set(id, String(room.type ?? '').trim().toLowerCase());
  }
  return map;
}

/**
 * Збирає потреби лише з реальних петель (loopLengthM > 0). Без fallback loopLengthM=0.
 * T повітря: пресет за room.type (санузел → 24 °C) або temps.insideC з анкети.
 *
 * @param {import('../types/shared-types').UnderfloorHeatingReport | null | undefined} underfloorHeating
 * @param {object} ctx
 * @param {number} ctx.surveyInsideC — temps.insideC (T повітря за замовчуванням)
 * @param {number | undefined | null} [ctx.bathroomAirTempC] — temps.bathroomAirTempC
 * @param {number} [ctx.systemPressureBar]
 * @param {Array<{ id?: string, type?: string }> | null | undefined} [ctx.rooms]
 * @returns {Array<{ roomId: string, loopId: string, required: UniboxLoopDemand }>}
 */
export function collectUniboxLoopDemands(underfloorHeating, ctx) {
  const surveyInsideC = Number(ctx.surveyInsideC ?? ctx.roomAirTempC);
  const bathroomAirTempC =
    typeof ctx.bathroomAirTempC === 'number' && Number.isFinite(ctx.bathroomAirTempC)
      ? ctx.bathroomAirTempC
      : undefined;
  const systemPressureBar =
    typeof ctx.systemPressureBar === 'number' && Number.isFinite(ctx.systemPressureBar)
      ? ctx.systemPressureBar
      : UNIBOX_DESIGN_PRESSURE_BAR;
  const roomTypeById = buildRoomTypeById(ctx.rooms);

  /** @type {Array<{ roomId: string, loopId: string, required: UniboxLoopDemand }>} */
  const out = [];
  if (!Number.isFinite(surveyInsideC)) return out;

  for (const room of underfloorHeating?.rooms ?? []) {
    const roomId = String(room.roomId ?? '');
    const roomType = roomTypeById.get(roomId) || '';
    const airResolved = resolveUniboxRoomAirTempC(
      roomType || undefined,
      surveyInsideC,
      bathroomAirTempC,
    );
    if (!airResolved) continue;

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

      /** @type {UniboxLoopDemand} */
      const required = {
        areaSqM,
        loopLengthM,
        circuitSupplyC: supplyC,
        circuitReturnC: returnC,
        flowLph,
        roomAirTempC: airResolved.roomAirTempC,
        roomAirTempSource: airResolved.roomAirTempSource,
        systemPressureBar,
        minKvM3h: minKvM3hForFlowLph(flowLph),
        requiredFit: UNIBOX_REQUIRED_FIT,
      };
      if (roomType) required.roomType = roomType;

      out.push({
        roomId,
        loopId: String(loop.loopId || `${roomId}-loop`),
        required,
      });
    }
  }
  return out;
}

/**
 * Чи є каскад ТП-колекторів (units > 1 на поверсі) — унібокси не підбираємо.
 * Сигнал з H.15 pickManifolds (не дублюємо splitOutletsForCascade).
 * manifolds.ok=false / порожній underfloor → не каскад (soft-fail колекторів).
 *
 * @param {import('../types/shared-types').ManifoldsMatchingReport | null | undefined} manifolds
 * @returns {boolean}
 */
export function hasUnderfloorManifoldCascade(manifolds) {
  for (const floor of manifolds?.underfloor ?? []) {
    if (floor == null || typeof floor !== 'object') continue;
    if ((floor.units?.length ?? 0) > 1) return true;
  }
  return false;
}

/**
 * Текст попередження, коли немає позиції під петлю.
 *
 * @param {string} loopId
 * @param {UniboxLoopDemand} required
 * @param {number} surveyInsideC
 * @returns {string}
 */
function buildNoMatchWarning(loopId, required, surveyInsideC) {
  let airSrc = `T воздуха=${required.roomAirTempC} °C (анкета temps.insideC)`;
  if (required.roomAirTempSource === 'bathroom_field') {
    airSrc = `T воздуха=${required.roomAirTempC} °C (temps.bathroomAirTempC)`;
  } else if (required.roomAirTempSource === 'preset') {
    airSrc =
      `T воздуха=${required.roomAirTempC} °C (пол 24 °C для «санузел»); ` +
      `анкета temps.insideC=${surveyInsideC} °C`;
  }
  const typePart = required.roomType ? `тип «${required.roomType}», ` : '';
  return (
    `Нет унибокса под петлю ${loopId} (${typePart}` +
    `площадь ${required.areaSqM} м², длина ${required.loopLengthM} м, ` +
    `подача ${required.circuitSupplyC} °C, обратка ${required.circuitReturnC} °C, ` +
    `${airSrc}, расход ${required.flowLph} л/ч, ` +
    `P=${required.systemPressureBar} бар, Kv>${required.minKvM3h.toFixed(3)}, ` +
    `fit=${required.requiredFit}).`
  );
}

/**
 * Оркестратор підбору унібоксів після pickManifolds, до гідравліки.
 *
 * @param {object} args
 * @param {import('../catalog/types').NormalizedCatalog | undefined} args.catalog
 * @param {import('../types/shared-types').UnderfloorHeatingReport | null | undefined} args.underfloorHeating
 * @param {number | undefined} args.roomAirTempC — temps.insideC (T повітря з анкети)
 * @param {number | undefined} [args.bathroomAirTempC] — temps.bathroomAirTempC
 * @param {number | undefined} [args.systemPressureBar]
 * @param {import('../types/shared-types').ManifoldsMatchingReport | null | undefined} [args.manifolds]
 * @param {Array<{ id?: string, type?: string }> | null | undefined} [args.rooms] — building.rooms для room.type
 * @returns {UniboxesMatchingReport}
 */
export function pickUniboxes({
  catalog,
  underfloorHeating = null,
  roomAirTempC,
  bathroomAirTempC,
  systemPressureBar,
  manifolds = null,
  rooms = null,
} = {}) {
  /** @type {UniboxCatalogItemNormalized[]} */
  const pool = catalog?.uniboxes ?? [];
  /** @type {string[]} */
  const warnings = [];

  const surveyInsideC = Number(roomAirTempC);
  if (!Number.isFinite(surveyInsideC)) {
    logger.info('matching.unibox.skip', null, { reason: 'no_survey_inside_c' });
    return { byLoop: [], warnings: [] };
  }

  const bathAir =
    typeof bathroomAirTempC === 'number' && Number.isFinite(bathroomAirTempC)
      ? bathroomAirTempC
      : undefined;

  const demands = collectUniboxLoopDemands(underfloorHeating, {
    surveyInsideC,
    bathroomAirTempC: bathAir,
    systemPressureBar,
    rooms,
  });

  logger.info('matching.unibox.start', null, {
    catalogCount: pool.length,
    loopDemands: demands.length,
    surveyInsideC,
  });

  if (!demands.length) {
    logger.info('matching.unibox.done', null, { byLoop: 0, warnings: 0 });
    return { byLoop: [], warnings: [] };
  }

  // Soft-fail колекторів: underfloor=[] → каскаду немає; підбір петель триває.
  if (manifolds && manifolds.ok === false) {
    const codePart = manifolds.failureCode ? ` (${manifolds.failureCode})` : '';
    warnings.push(
      'Подбор унибоксов выполняется без сигнала каскада коллекторов: '
        + `matching.manifolds.ok=false${codePart}.`,
    );
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
    const validated = validateUniboxLoopDemand(demand.required, {
      roomId: demand.roomId,
      loopId: demand.loopId,
    });
    if (!validated.ok) {
      rowWarnings.push(validated.message);
      warnings.push(validated.message);
      byLoop.push({
        roomId: demand.roomId,
        loopId: demand.loopId,
        required: demand.required,
        selected: null,
        warnings: rowWarnings,
      });
      continue;
    }

    const selected = pickUniboxForDemand(pool, demand.required);
    if (!selected) {
      const msg = buildNoMatchWarning(demand.loopId, demand.required, surveyInsideC);
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
    airSamples: byLoop.map((r) => ({
      roomId: r.roomId,
      roomType: r.required.roomType ?? null,
      roomAirTempC: r.required.roomAirTempC,
      roomAirTempSource: r.required.roomAirTempSource ?? null,
      selectedId: r.selected?.id ?? null,
    })),
  });

  return { byLoop, warnings };
}

export {
  resolveUniboxRoomAirTempC,
  UNIBOX_ROOM_AIR_TEMP_PRESETS_C,
  UNIBOX_SMALL_ZONE_ROOM_TYPES,
  isUniboxSmallZoneRoomType,
} from './internal/uniboxRoomAirPresets.js';
