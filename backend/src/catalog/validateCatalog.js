/**
 * Назначение: валидация и нормализация каталога.
 * Описание: проверка числовых полей, mountingType (boilerCatalogHelpers), типов оборудования
 * и санитизация строк перед использованием в формулах подбора; защита от NaN и физически
 * некорректных значений.
 */
import { isPlainObject } from '../utils/isPlainObject.js';
import { sanitizeTrimAngleBrackets } from '../utils/sanitizeString.js';
import { applyBoilerMountingType } from './boilerCatalogHelpers.js';
import { derivePipeModelLabel } from './pipeCatalogHelpers.js';
import { derivePumpCatalogIdFromModel } from './pumpCatalogHelpers.js';
import {
  assertPumpModeCurveGeometry,
  normalizePumpModeQMaxToCurve,
  PUMP_CURVE_MIN_HEAD_AT_QMAX_M,
} from '../utils/pumpCurveMath.js';
import {
  assertKnownManifoldSeriesGeometry,
  normalizeInchLabel,
} from './manifoldSeriesGeometry.js';
import { assertKnownBoilerManifoldSeriesGeometry } from './boilerManifoldSeriesGeometry.js';

function toFiniteNumber(x, { field, min = -Infinity, max = Infinity } = {}) {
  const n = Number(x);
  if (!Number.isFinite(n)) {
    throw new Error(`Каталог: поле ${field} должно быть числом.`);
  }
  if (n < min || n > max) {
    throw new Error(`Каталог: поле ${field} вне диапазона (${min}..${max}).`);
  }
  return n;
}

/**
 * Приводит «расширенные» записи из test_data.json к полям, ожидаемым подбором (MVP).
 * @param {Record<string, unknown>} item
 */
function normalizeBoilerFromExtendedFormats(item) {
  if (!isPlainObject(item)) return;

  if (!isPlainObject(item.powerKw)) {
    const specs = /** @type {Record<string, unknown>} */ (item.specs);
    const sp = specs && isPlainObject(specs.power) ? specs.power : null;
    const rp = isPlainObject(item.power) ? item.power : null;
    const min = (sp?.min_kw ?? rp?.min_kw) ?? null;
    const max =
      (sp?.max_heating_kw ?? rp?.max_heating_kw ?? sp?.max_dhw_kw ?? rp?.max_dhw_kw) ?? null;
    if (
      min != null &&
      max != null &&
      Number.isFinite(Number(min)) &&
      Number.isFinite(Number(max))
    ) {
      item.powerKw = { min: Number(min), max: Number(max) };
    }
  }

  if (!sanitizeTrimAngleBrackets(item.fuel)) item.fuel = 'Газ';

  if (item.efficiencyPercent != null && typeof item.efficiencyPercent === 'object') {
    const o = /** @type {Record<string, unknown>} */ (item.efficiencyPercent);
    const v = o.nominal_80_60 ?? o.condensing_50_30 ?? o.seasonal;
    if (v != null && Number.isFinite(Number(v))) item.efficiencyPercent = Number(v);
    else delete item.efficiencyPercent;
  }
  if (
    (item.efficiencyPercent == null || item.efficiencyPercent === '') &&
    isPlainObject(item.specs) &&
    isPlainObject(/** @type {Record<string, unknown>} */ (item.specs).efficiency)
  ) {
    const eff = /** @type {Record<string, unknown>} */ (
      /** @type {Record<string, unknown>} */ (item.specs).efficiency
    );
    const v = eff.nominal_80_60 ?? eff.condensing_50_30;
    if (v != null && Number.isFinite(Number(v))) item.efficiencyPercent = Number(v);
  }

  // Количество контуров из тегов (если не задано числом) — до синхронизации с isDoubleCircuit.
  if (item.circuitsCount == null && Array.isArray(item.tags)) {
    const tagSet = new Set(item.tags.map((t) => sanitizeTrimAngleBrackets(t).toLowerCase()));
    if (tagSet.has('double-circuit')) item.circuitsCount = 2;
    else if (tagSet.has('single-circuit')) item.circuitsCount = 1;
  }

  if (item.isDoubleCircuit !== true && item.isDoubleCircuit !== false) {
    const cc = item.circuitsCount;
    if (cc === 2) item.isDoubleCircuit = true;
    else if (cc === 1) item.isDoubleCircuit = false;
    else {
      const m = sanitizeTrimAngleBrackets(item.model).toLowerCase();
      if (/\bduo\b|duo-tec|двух|double-circuit/.test(m)) item.isDoubleCircuit = true;
      else item.isDoubleCircuit = false;
    }
  }

  if (item.gasConsumptionM3PerHour == null) {
    let g = item.gas_consumption_max_m3_h;
    if (g == null && isPlainObject(item.specs)) {
      const specs = /** @type {Record<string, unknown>} */ (item.specs);
      const gc = specs.gas_consumption;
      if (isPlainObject(gc)) {
        g = /** @type {Record<string, unknown>} */ (gc).max_m3_h;
      }
    }
    if (g != null && Number.isFinite(Number(g))) item.gasConsumptionM3PerHour = Number(g);
  }
}

/** Панельный радиатор — теплоотдача целиком по изделию (specs.thermal_output_full). */
function radiatorLooksLikePanelRecord(item) {
  const specs = /** @type {Record<string, unknown>} */ (item.specs);
  return Boolean(specs && isPlainObject(specs.thermal_output_full));
}

/**
 * Оценка базиса цены для радиатора (если в JSON не задан priceBasis).
 * @param {Record<string, unknown>} item
 */
function inferRadiatorPriceBasis(item) {
  if (radiatorLooksLikePanelRecord(item)) return 'panel';
  const t = sanitizeTrimAngleBrackets(item.type).toLowerCase();
  if (t.includes('steel panel') || /\bpanel\b/.test(t)) return 'panel';
  const c = sanitizeTrimAngleBrackets(item.construction).toLowerCase();
  if (c.includes('monolith')) return 'panel';
  return 'section';
}

function normalizeRadiatorFromExtendedFormats(item) {
  if (!isPlainObject(item)) return;

  if (!isPlainObject(item.outputWatts)) {
    const specs = /** @type {Record<string, unknown>} */ (item.specs);
    const ts =
      specs && isPlainObject(specs.thermal_output_section)
        ? specs.thermal_output_section
        : null;
    const tf =
      specs && isPlainObject(specs.thermal_output_full) ? specs.thermal_output_full : null;
    const dt50 = ts?.dt_50_w ?? tf?.dt_50_w;
    const dt70 = ts?.dt_70_w ?? tf?.dt_70_w;
    if (dt50 != null && dt70 != null) {
      item.outputWatts = { deltaT50: Number(dt50), deltaT70: Number(dt70) };
    }
  }

  if (item.volumeLiters == null && isPlainObject(item.specs)) {
    const specs = /** @type {Record<string, unknown>} */ (item.specs);
    const v = specs.volume_l_section ?? specs.volume_l_total;
    if (v != null && Number.isFinite(Number(v))) item.volumeLiters = Number(v);
  }

  if (!sanitizeTrimAngleBrackets(item.material)) item.material = 'разное';

  if (item.dimensions == null && isPlainObject(item.specs) && isPlainObject(item.specs.dimensions)) {
    const specs = /** @type {Record<string, unknown>} */ (item.specs);
    const d = /** @type {Record<string, unknown>} */ (specs.dimensions);
    const isPanel = isPlainObject(specs.thermal_output_full);
    const height = d.height_mm ?? d.height;
    const depth = d.depth_mm ?? d.depth;
    const interaxle = d.center_distance_mm ?? d.interaxle;
    const lengthMm = d.length_mm ?? null;
    const width = isPanel
      ? (lengthMm ?? d.width_section_mm ?? d.width)
      : (d.width_section_mm ?? lengthMm ?? d.width ?? depth);
    if (width != null) {
      item.dimensions = {
        height: height != null ? Number(height) : undefined,
        width: Number(width),
        depth: depth != null ? Number(depth) : undefined,
        interaxle: interaxle != null ? Number(interaxle) : undefined,
      };
    }
  }
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} ctx
 * @param {1 | 2} expectedCircuitsCount Ожидаемое число контуров для секции каталога (doubleCircuit | singleCircuit).
 */
function validateBoiler(item, ctx, expectedCircuitsCount) {
  if (!isPlainObject(item)) throw new Error(`Каталог: котёл должен быть объектом (${ctx}).`);

  item.model = sanitizeTrimAngleBrackets(item.model);
  if (!item.model) throw new Error(`Каталог: model обязателен (${ctx}).`);

  normalizeBoilerFromExtendedFormats(item);

  const boolCirc = item.isDoubleCircuit;
  if (boolCirc != null && typeof boolCirc !== 'boolean') {
    throw new Error(`Каталог: isDoubleCircuit должен быть boolean (${ctx}).`);
  }

  let ccRaw =
    item.circuitsCount != null && Number.isFinite(Number(item.circuitsCount))
      ? Number(item.circuitsCount)
      : null;

  if (boolCirc === true && ccRaw != null && ccRaw !== 2) {
    throw new Error(`Каталог: при isDoubleCircuit=true ожидается circuitsCount=2 (${ctx}).`);
  }
  if (boolCirc === false && ccRaw != null && ccRaw !== 1) {
    throw new Error(`Каталог: при isDoubleCircuit=false ожидается circuitsCount=1 (${ctx}).`);
  }

  let cc = ccRaw;
  if (cc == null && boolCirc === true) cc = 2;
  if (cc == null && boolCirc === false) cc = 1;
  // Если в записи не указано число контуров и флаг двухконтурности не задан — используем секцию каталога.
  if (cc == null) cc = expectedCircuitsCount;

  item.circuitsCount = toFiniteNumber(cc, {
    field: `circuitsCount (${ctx})`,
    min: 1,
    max: 3,
  });

  if (item.circuitsCount !== expectedCircuitsCount) {
    throw new Error(
      `Каталог: circuitsCount=${item.circuitsCount} не соответствует секции каталога (ожидается ${expectedCircuitsCount}) (${ctx}).`,
    );
  }

  item.isDoubleCircuit = item.circuitsCount === 2;

  if (!isPlainObject(item.powerKw)) throw new Error(`Каталог: powerKw обязателен (${ctx}).`);
  // Ноль или отрицательные значения мощности приведут к абсурдному подбору.
  // Поэтому задаём нижнюю границу > 0 (минимум 0.1 кВт).
  item.powerKw.max = toFiniteNumber(item.powerKw.max, { field: `powerKw.max (${ctx})`, min: 0.1 });
  item.powerKw.min = toFiniteNumber(item.powerKw.min, { field: `powerKw.min (${ctx})`, min: 0.1 });
  if (item.powerKw.min > item.powerKw.max) {
    throw new Error(`Каталог: powerKw.min > powerKw.max (${ctx}).`);
  }

  item.fuel = sanitizeTrimAngleBrackets(item.fuel);
  if (item.fuel && !['Газ', 'Электричество', 'Твердое топливо', 'Твердотопливный'].includes(item.fuel)) {
    // Мягкая проверка enum: можно расширять список по мере появления.
    // Не бросаем ошибку, если fuel пустой/неизвестный — но фиксируем очевидный мусор в model/power.
  }

  // После нормализации не оставляем объект КПД (Mongoose / валидация ожидают число).
  if (item.efficiencyPercent != null && typeof item.efficiencyPercent === 'object') {
    delete item.efficiencyPercent;
  }

  if (item.efficiencyPercent != null) {
    item.efficiencyPercent = toFiniteNumber(item.efficiencyPercent, {
      field: `efficiencyPercent (${ctx})`,
      min: 1,
      max: 150,
    });
  }

  if (item.gasConsumptionM3PerHour != null) {
    item.gasConsumptionM3PerHour = toFiniteNumber(item.gasConsumptionM3PerHour, {
      field: `gasConsumptionM3PerHour (${ctx})`,
      min: 0,
      max: 20,
    });
  }

  item.price = toFiniteNumber(item.price, {
    field: `price (${ctx})`,
    min: 1,
    max: 1_000_000_000,
  });

  applyBoilerMountingType(item, ctx);

  if (item.connectionDiameters != null) {
    if (!Array.isArray(item.connectionDiameters)) {
      throw new Error(`Каталог: connectionDiameters должен быть массивом строк (${ctx}).`);
    }
    item.connectionDiameters = item.connectionDiameters
      .map((x) => sanitizeTrimAngleBrackets(x))
      .filter(Boolean);
  }

  if (item.combustionType != null) {
    const c = sanitizeTrimAngleBrackets(item.combustionType).toLowerCase();
    if (c === 'turbo' || c === 'atmospheric') item.combustionType = c;
    else delete item.combustionType;
  }

  item.type = sanitizeTrimAngleBrackets(item.type).toLowerCase();
  if (!item.type) {
    throw new Error(`Каталог: type обязателен (непустая строка) (${ctx}).`);
  }

  if (item.tags != null) {
    if (!Array.isArray(item.tags)) {
      throw new Error(`Каталог: tags должен быть массивом строк (${ctx}).`);
    }
    item.tags = item.tags.map((x) => sanitizeTrimAngleBrackets(x)).filter(Boolean);
  }

  if (item.priceSegment != null) {
    item.priceSegment = sanitizeTrimAngleBrackets(item.priceSegment).toLowerCase();
  }

  if (item.circulationPump != null) {
    if (!isPlainObject(item.circulationPump)) {
      throw new Error(`Каталог: circulationPump должен быть объектом (${ctx}).`);
    }
    const circulationPump = /** @type {Record<string, unknown>} */ (item.circulationPump);
    if (
      !Array.isArray(circulationPump.operatingModes)
      || circulationPump.operatingModes.length < 1
    ) {
      throw new Error(
        `Каталог: circulationPump.operatingModes — непустой массив (${ctx}).`,
      );
    }
    circulationPump.operatingModes.forEach((mode, mi) => {
      validatePumpOperatingMode(mode, `${ctx}.circulationPump.operatingModes[${mi}]`);
    });
  }
}

function validateRadiator(item, idx) {
  if (!isPlainObject(item)) throw new Error(`Каталог: радиатор должен быть объектом (radiators[${idx}]).`);

  item.model = sanitizeTrimAngleBrackets(item.model);
  if (!item.model) throw new Error(`Каталог: model обязателен (radiators[${idx}]).`);

  normalizeRadiatorFromExtendedFormats(item);

  const looksPanel = radiatorLooksLikePanelRecord(item);
  const outputDt50Max = looksPanel ? 10_000 : 2000;
  const outputDt70Max = looksPanel ? 15_000 : 3000;

  if (!isPlainObject(item.outputWatts)) throw new Error(`Каталог: outputWatts обязателен (radiators[${idx}]).`);
  item.outputWatts.deltaT50 = toFiniteNumber(item.outputWatts.deltaT50, {
    field: `outputWatts.deltaT50 (radiators[${idx}])`,
    min: 1,
    max: outputDt50Max,
  });
  item.outputWatts.deltaT70 = toFiniteNumber(item.outputWatts.deltaT70, {
    field: `outputWatts.deltaT70 (radiators[${idx}])`,
    min: 1,
    max: outputDt70Max,
  });

  item.material = sanitizeTrimAngleBrackets(item.material);
  if (item.volumeLiters != null) {
    item.volumeLiters = toFiniteNumber(item.volumeLiters, {
      field: `volumeLiters (radiators[${idx}])`,
      min: 0,
      max: 50,
    });
  }

  const widthMaxMm = looksPanel || item.priceBasis === 'panel' ? 3000 : 500;

  // Габариты (мм): для секции — ширина секции; для панели — длина прибора в width/sectionWidthMm.
  if (item.dimensions != null) {
    if (!isPlainObject(item.dimensions)) {
      throw new Error(`Каталог: dimensions должен быть объектом (radiators[${idx}]).`);
    }
    if (item.dimensions.width == null) {
      throw new Error(`Каталог: dimensions.width обязателен (radiators[${idx}]).`);
    }
    item.dimensions.width = toFiniteNumber(item.dimensions.width, {
      field: `dimensions.width (radiators[${idx}])`,
      min: 20,
      max: widthMaxMm,
    });

    if (item.dimensions.height != null) {
      item.dimensions.height = toFiniteNumber(item.dimensions.height, {
        field: `dimensions.height (radiators[${idx}])`,
        min: 100,
        max: 3000,
      });
    }
    if (item.dimensions.depth != null) {
      item.dimensions.depth = toFiniteNumber(item.dimensions.depth, {
        field: `dimensions.depth (radiators[${idx}])`,
        min: 10,
        max: 500,
      });
    }
    if (item.dimensions.interaxle != null) {
      item.dimensions.interaxle = toFiniteNumber(item.dimensions.interaxle, {
        field: `dimensions.interaxle (radiators[${idx}])`,
        min: 100,
        max: 2500,
      });
    }

    // Удобный алиас для расчётов
    item.sectionWidthMm = item.dimensions.width;
  }

  item.price = toFiniteNumber(item.price, {
    field: `price (radiators[${idx}])`,
    min: 1,
    max: 1_000_000_000,
  });

  let priceBasis = sanitizeTrimAngleBrackets(item.priceBasis).toLowerCase();
  if (priceBasis !== 'section' && priceBasis !== 'panel') {
    priceBasis = inferRadiatorPriceBasis(item);
  }
  if (priceBasis !== 'section' && priceBasis !== 'panel') {
    throw new Error(`Каталог: priceBasis должен быть "section" или "panel" (radiators[${idx}]).`);
  }
  item.priceBasis = priceBasis;

  if (item.priceBasis === 'panel' && !looksPanel) {
    throw new Error(
      `Каталог: priceBasis=panel допустим только для позиций с specs.thermal_output_full (radiators[${idx}]).`,
    );
  }
  if (item.priceBasis === 'section' && looksPanel) {
    throw new Error(
      `Каталог: для панельного типа (thermal_output_full) укажите priceBasis=panel (radiators[${idx}]).`,
    );
  }
}

function validateWaterHeater(item, idx) {
  if (!isPlainObject(item)) {
    throw new Error(`Каталог: водонагреватель должен быть объектом (waterHeaters[${idx}]).`);
  }

  item.model = sanitizeTrimAngleBrackets(item.model);
  if (!item.model) throw new Error(`Каталог: model обязателен (waterHeaters[${idx}]).`);

  const typeRaw = item.type != null ? sanitizeTrimAngleBrackets(item.type).trim().toLowerCase() : '';
  if (!typeRaw) {
    item.type = 'electric_storage';
  } else if (typeRaw !== 'electric_storage') {
    throw new Error(
      `Каталог: waterHeaters[${idx}].type ожидается "electric_storage" (получено "${typeRaw}").`,
    );
  } else {
    item.type = typeRaw;
  }

  if (!Array.isArray(item.variants) || item.variants.length < 1) {
    throw new Error(`Каталог: variants должен быть непустым массивом (waterHeaters[${idx}]).`);
  }

  const seenVolumes = new Set();
  /** @type {{ volumeLiters: number; price: number; powerKw?: number; heatingTimeMinutes?: number }[]} */
  const normalizedVariants = [];

  item.variants.forEach((raw, vi) => {
    if (!isPlainObject(raw)) {
      throw new Error(`Каталог: variants[${vi}] должен быть объектом (waterHeaters[${idx}]).`);
    }

    const volumeLiters = toFiniteNumber(raw.volumeLiters, {
      field: `variants[${vi}].volumeLiters (waterHeaters[${idx}])`,
      min: 1,
      max: 1000,
    });
    if (seenVolumes.has(volumeLiters)) {
      throw new Error(
        `Каталог: дубликат volumeLiters=${volumeLiters} в variants (waterHeaters[${idx}]).`,
      );
    }
    seenVolumes.add(volumeLiters);

    const price = toFiniteNumber(raw.price, {
      field: `variants[${vi}].price (waterHeaters[${idx}])`,
      min: 1,
      max: 1_000_000_000,
    });

    /** @type {{ volumeLiters: number; price: number; powerKw?: number; heatingTimeMinutes?: number }} */
    const nv = { volumeLiters, price };
    if (raw.powerKw != null) {
      nv.powerKw = toFiniteNumber(raw.powerKw, {
        field: `variants[${vi}].powerKw (waterHeaters[${idx}])`,
        min: 0.1,
        max: 30,
      });
    }
    if (raw.heatingTimeMinutes != null) {
      nv.heatingTimeMinutes = toFiniteNumber(raw.heatingTimeMinutes, {
        field: `variants[${vi}].heatingTimeMinutes (waterHeaters[${idx}])`,
        min: 1,
        max: 10080,
      });
    }
    normalizedVariants.push(nv);
  });

  normalizedVariants.sort((a, b) => a.volumeLiters - b.volumeLiters);
  item.variants = normalizedVariants;

  delete item.powerKw;

  if (item.heatingElementType != null) {
    item.heatingElementType = sanitizeTrimAngleBrackets(item.heatingElementType);
  }

  if (item.powerDetails != null) {
    item.powerDetails = sanitizeTrimAngleBrackets(item.powerDetails);
  }

  if (item.features != null) {
    if (!Array.isArray(item.features)) {
      throw new Error(`Каталог: features должен быть массивом строк (waterHeaters[${idx}]).`);
    }
    item.features = item.features.map((x) => sanitizeTrimAngleBrackets(x)).filter(Boolean);
  }
}

/**
 * @param {Record<string, unknown>} item
 * @param {number} idx
 * @param {Set<string>} seenIds
 */
function validatePipe(item, idx, seenIds) {
  const ctx = `pipes[${idx}]`;
  if (!isPlainObject(item)) {
    throw new Error(`Каталог: pipe[${idx}] должен быть объектом.`);
  }

  item.id = sanitizeTrimAngleBrackets(item.id);
  if (!item.id) {
    throw new Error(`Каталог: id обязателен (${ctx}).`);
  }
  if (seenIds.has(item.id)) {
    throw new Error(`Каталог: дубликат id="${item.id}" (${ctx}).`);
  }
  seenIds.add(item.id);

  item.brand = sanitizeTrimAngleBrackets(item.brand);
  if (!item.brand) {
    throw new Error(`Каталог: brand обязателен (${ctx}).`);
  }

  item.material = sanitizeTrimAngleBrackets(item.material);
  if (!item.material) {
    throw new Error(`Каталог: material обязателен (${ctx}).`);
  }

  if (item.category != null) {
    item.category = sanitizeTrimAngleBrackets(item.category);
  }

  item.diameter = toFiniteNumber(item.diameter, {
    field: `${ctx}.diameter`,
    min: 1,
    max: 1000,
  });

  item.wallThickness = toFiniteNumber(item.wallThickness, {
    field: `${ctx}.wallThickness`,
    min: 0.1,
    max: 100,
  });

  item.price = toFiniteNumber(item.price, {
    field: `${ctx}.price`,
    min: 1,
    max: 1_000_000_000,
  });

  let model = sanitizeTrimAngleBrackets(item.model);
  if (!model) {
    model = derivePipeModelLabel(item, idx);
  }
  item.model = model;
  if (!item.model) {
    throw new Error(`Каталог: model обязателен (${ctx}).`);
  }
}

/** Допустимые типы насосов в каталоге. */
const PUMP_TYPES_ALLOWED = Object.freeze([
  'electronic',
  'three_speed',
  'circulation_hot_water',
]);

/** Допустимые сегменты насосов. */
const PUMP_SEGMENTS_ALLOWED = Object.freeze(['premium', 'medium', 'budget']);

/**
 * Насосы: корень JSON или `products.pumps`.
 *
 * @param {Record<string, unknown>} json
 * @returns {unknown[]}
 */
function collectPumps(json) {
  if (Array.isArray(json.pumps)) return json.pumps;
  const p = json.products;
  if (isPlainObject(p) && Array.isArray(p.pumps)) return p.pumps;
  return [];
}

/**
 * Импорт legacy-формата насосов (commercial.priceEstimate, _id.$oid, kind) в контракт PumpCatalogItem.
 * Канонический JSON: id, price на верхнем уровне; валюта — только currency каталога, не у позиции.
 *
 * @param {Record<string, unknown>} item
 * @param {number} idx
 */
function normalizePumpFromExtendedFormats(item, idx) {
  if (item.price == null && isPlainObject(item.commercial)) {
    const commercial = /** @type {Record<string, unknown>} */ (item.commercial);
    if (commercial.priceEstimate != null) {
      item.price = commercial.priceEstimate;
    }
  }

  if (!sanitizeTrimAngleBrackets(item.id)) {
    const oidWrap = item._id;
    if (isPlainObject(oidWrap) && oidWrap.$oid != null) {
      item.id = `pump-${String(oidWrap.$oid).trim()}`;
    } else {
      const model = sanitizeTrimAngleBrackets(item.model);
      item.id = derivePumpCatalogIdFromModel(model || '', idx);
    }
  }

  delete item._id;
  delete item.kind;
  delete item.commercial;
}

/**
 * @param {unknown} raw
 * @param {string} ctx
 */
function validatePumpOperatingMode(raw, ctx) {
  if (!isPlainObject(raw)) {
    throw new Error(`Каталог: ${ctx} должен быть объектом.`);
  }

  /** @type {Record<string, unknown>} */
  const mode = raw;
  mode.modeName = sanitizeTrimAngleBrackets(mode.modeName);
  if (!mode.modeName) {
    throw new Error(`Каталог: modeName обязателен (${ctx}).`);
  }

  mode.speedIndex = toFiniteNumber(mode.speedIndex, {
    field: `${ctx}.speedIndex`,
    min: 1,
    max: 9,
  });

  mode.powerWatts = toFiniteNumber(mode.powerWatts, {
    field: `${ctx}.powerWatts`,
    min: 0,
    max: 10_000,
  });

  if (!isPlainObject(mode.coefficients)) {
    throw new Error(`Каталог: coefficients обязателен (${ctx}).`);
  }
  const coef = /** @type {Record<string, unknown>} */ (mode.coefficients);
  coef.a = toFiniteNumber(coef.a, { field: `${ctx}.coefficients.a`, min: -100, max: 100 });
  coef.b = toFiniteNumber(coef.b, { field: `${ctx}.coefficients.b`, min: -100, max: 100 });
  coef.c = toFiniteNumber(coef.c, { field: `${ctx}.coefficients.c`, min: -100, max: 100 });

  mode.qMinM3h = toFiniteNumber(mode.qMinM3h, {
    field: `${ctx}.qMinM3h`,
    min: 0,
    max: 100,
  });
  mode.qMaxM3h = toFiniteNumber(mode.qMaxM3h, {
    field: `${ctx}.qMaxM3h`,
    min: 0,
    max: 100,
  });
  if (mode.qMaxM3h < mode.qMinM3h) {
    throw new Error(`Каталог: qMaxM3h < qMinM3h (${ctx}).`);
  }

  /** @type {{ qMinM3h: number; qMaxM3h: number; coefficients: object }} */
  const modeCurve = {
    qMinM3h: /** @type {number} */ (mode.qMinM3h),
    qMaxM3h: /** @type {number} */ (mode.qMaxM3h),
    coefficients: coef,
  };
  normalizePumpModeQMaxToCurve(modeCurve, ctx, PUMP_CURVE_MIN_HEAD_AT_QMAX_M);
  mode.qMaxM3h = modeCurve.qMaxM3h;

  assertPumpModeCurveGeometry(
    modeCurve,
    ctx,
    PUMP_CURVE_MIN_HEAD_AT_QMAX_M,
  );
}

/**
 * @param {unknown} item
 * @param {number} idx
 * @param {Set<string>} seenIds
 */
function validatePump(item, idx, seenIds) {
  const ctx = `pumps[${idx}]`;
  if (!isPlainObject(item)) {
    throw new Error(`Каталог: pump[${idx}] должен быть объектом.`);
  }

  normalizePumpFromExtendedFormats(item, idx);

  item.id = sanitizeTrimAngleBrackets(item.id);
  if (!item.id) {
    throw new Error(`Каталог: id обязателен (${ctx}).`);
  }
  if (seenIds.has(item.id)) {
    throw new Error(`Каталог: дубликат id="${item.id}" (${ctx}).`);
  }
  seenIds.add(item.id);

  item.brand = sanitizeTrimAngleBrackets(item.brand);
  if (!item.brand) {
    throw new Error(`Каталог: brand обязателен (${ctx}).`);
  }

  item.model = sanitizeTrimAngleBrackets(item.model);
  if (!item.model) {
    throw new Error(`Каталог: model обязателен (${ctx}).`);
  }

  if (item.series != null) {
    item.series = sanitizeTrimAngleBrackets(item.series);
  }
  if (item.country != null) {
    item.country = sanitizeTrimAngleBrackets(item.country);
  }

  const typeRaw = sanitizeTrimAngleBrackets(item.type).trim().toLowerCase();
  if (!PUMP_TYPES_ALLOWED.includes(typeRaw)) {
    throw new Error(
      `Каталог: pumps[${idx}].type недопустимое значение "${String(item.type)}"; ` +
        `разрешено: ${PUMP_TYPES_ALLOWED.join(' | ')}.`,
    );
  }
  item.type = typeRaw;

  const segmentRaw = sanitizeTrimAngleBrackets(item.segment).trim().toLowerCase();
  if (!PUMP_SEGMENTS_ALLOWED.includes(segmentRaw)) {
    throw new Error(
      `Каталог: pumps[${idx}].segment недопустимое значение "${String(item.segment)}"; ` +
        `разрешено: ${PUMP_SEGMENTS_ALLOWED.join(' | ')}.`,
    );
  }
  item.segment = segmentRaw;

  item.price = toFiniteNumber(item.price, {
    field: `${ctx}.price`,
    min: 1,
    max: 1_000_000_000,
  });

  if (!isPlainObject(item.connections)) {
    throw new Error(`Каталог: connections обязателен (${ctx}).`);
  }
  const conn = /** @type {Record<string, unknown>} */ (item.connections);
  conn.mountingLengthMm = toFiniteNumber(conn.mountingLengthMm, {
    field: `${ctx}.connections.mountingLengthMm`,
    min: 1,
    max: 1000,
  });
  conn.threadInch = sanitizeTrimAngleBrackets(conn.threadInch);
  if (!conn.threadInch) {
    throw new Error(`Каталог: connections.threadInch обязателен (${ctx}).`);
  }
  conn.nominalDiameterMm = toFiniteNumber(conn.nominalDiameterMm, {
    field: `${ctx}.connections.nominalDiameterMm`,
    min: 1,
    max: 500,
  });

  if (!Array.isArray(item.operatingModes) || item.operatingModes.length < 1) {
    throw new Error(`Каталог: operatingModes — непустой массив (${ctx}).`);
  }
  item.operatingModes.forEach((mode, mi) => {
    validatePumpOperatingMode(mode, `${ctx}.operatingModes[${mi}]`);
  });
}

/**
 * Бойлеры косвенного нагрева (БКН): корень JSON или `products.indirectWaterHeaters`.
 *
 * @param {Record<string, unknown>} json
 * @returns {unknown[]}
 */
function collectIndirectWaterHeaters(json) {
  if (Array.isArray(json.indirectWaterHeaters)) return json.indirectWaterHeaters;
  const p = json.products;
  if (isPlainObject(p) && Array.isArray(p.indirectWaterHeaters)) return p.indirectWaterHeaters;
  return [];
}

/** Допустимые значения mounting/placement каталога БКН после нормализации. */
const INDIRECT_WATER_HEATER_TYPES_ALLOWED = Object.freeze([
  'indirect_wall',
  'indirect_floor',
  'storage_indirect',
]);

/**
 * @param {string} normalized
 */
function isAllowedIndirectWaterHeaterType(normalized) {
  return INDIRECT_WATER_HEATER_TYPES_ALLOWED.includes(normalized);
}

/**
 * Нормализует поле **type** БКН — три независимых допустимых значения классификации в каталоге (не взаимозаменяемы).
 * @param {unknown} raw
 * @param {number} idx
 */
function normalizeIndirectWaterHeaterType(raw, idx) {
  const s = sanitizeTrimAngleBrackets(raw).trim().toLowerCase();
  // «indirect wall», «indirect-wall», лишние пробелы
  const collapsed = s.replace(/[\s-]+/g, '_');
  if (!collapsed) {
    throw new Error(
      `Каталог: indirectWaterHeaters[${idx}].type обязателен; допускаются только: indirect_wall | indirect_floor | storage_indirect (три разных класса номенклатуры).`,
    );
  }
  if (!isAllowedIndirectWaterHeaterType(collapsed)) {
    throw new Error(
      `Каталог: indirectWaterHeaters[${idx}].type недопустимое значение "${s}" (нормализовано: "${collapsed}"). Разрешено только: indirect_wall (настенный БКН), indirect_floor (напольный БКН), storage_indirect (отдельный номенклатурный тип БКН в каталоге, не смешивать с wall/floor).`,
    );
  }
  return collapsed;
}

/**
 * @param {unknown} item
 * @param {number} idx
 */
function validateIndirectWaterHeater(item, idx) {
  if (!isPlainObject(item)) {
    throw new Error(`Каталог: indirectWaterHeaters[${idx}] должен быть объектом.`);
  }

  item.model = sanitizeTrimAngleBrackets(item.model);
  if (!item.model) {
    throw new Error(`Каталог: model обязателен (indirectWaterHeaters[${idx}]).`);
  }

  if (item.brand != null) item.brand = sanitizeTrimAngleBrackets(item.brand);
  if (item.article != null) item.article = sanitizeTrimAngleBrackets(item.article);

  item.type = normalizeIndirectWaterHeaterType(item.type, idx);

  // Цена в валюте каталога (UAH): берём из прайсов официальных представителей / авторизованных дистрибьюторов в UA (ниже строк в тестовых данных).
  item.price = toFiniteNumber(item.price, {
    field: `indirectWaterHeaters[${idx}].price`,
    min: 1,
    max: 1_000_000_000,
  });

  const specs = item.specs;
  if (!isPlainObject(specs)) {
    throw new Error(`Каталог: indirectWaterHeaters[${idx}].specs должен быть объектом.`);
  }

  specs.volumeLiters = toFiniteNumber(specs.volumeLiters, {
    field: `indirectWaterHeaters[${idx}].specs.volumeLiters`,
    min: 1,
    max: 5000,
  });

  for (const key of ['powerKw', 'surfaceAreaM2', 'maxTempC', 'heatingTimeMinutes', 'standingLossKwh24h']) {
    if (specs[key] != null) {
      specs[key] = toFiniteNumber(specs[key], {
        field: `indirectWaterHeaters[${idx}].specs.${String(key)}`,
        min: 0,
        max: 1_000_000,
      });
    }
  }

  // Минимальная рекомендуемая мощность теплоносителя/котла для штатного нагрева (кВт); опционально.
  if (specs.minSourcePowerKw != null) {
    specs.minSourcePowerKw = toFiniteNumber(specs.minSourcePowerKw, {
      field: `indirectWaterHeaters[${idx}].specs.minSourcePowerKw`,
      min: 0.1,
      max: 500,
    });
  }
}

/** Допустимые назначения коллектора в каталоге. */
const MANIFOLD_APPLICATIONS_ALLOWED = Object.freeze(['radiator', 'underfloor']);

/**
 * Коллекторы: корень JSON или `products.manifold`.
 *
 * @param {Record<string, unknown>} json
 * @returns {unknown[]}
 */
function collectManifolds(json) {
  if (Array.isArray(json.manifold)) return json.manifold;
  const p = json.products;
  if (isPlainObject(p) && Array.isArray(p.manifold)) return p.manifold;
  return [];
}

/**
 * Котельные коллекторы: корень JSON или `products.boilerManifold`.
 *
 * @param {Record<string, unknown>} json
 * @returns {unknown[]}
 */
function collectBoilerManifolds(json) {
  if (Array.isArray(json.boilerManifold)) return json.boilerManifold;
  const p = json.products;
  if (isPlainObject(p) && Array.isArray(p.boilerManifold)) return p.boilerManifold;
  return [];
}

/**
 * @param {unknown} x
 * @param {{ field: string, min?: number, max?: number }} opts
 * @returns {number}
 */
function toFiniteInteger(x, { field, min = -Infinity, max = Infinity }) {
  const n = toFiniteNumber(x, { field, min, max });
  if (!Number.isInteger(n)) {
    throw new Error(`Каталог: поле ${field} должно быть целым числом.`);
  }
  return n;
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} ctx
 */
function validateManifoldDimensions(item, ctx) {
  if (!isPlainObject(item.dimensions)) {
    throw new Error(`Каталог: объект dimensions обязателен для коллектора (${ctx}).`);
  }
  const dim = /** @type {Record<string, unknown>} */ (item.dimensions);
  dim.width = toFiniteNumber(dim.width, {
    field: `${ctx}.dimensions.width`,
    min: 50,
    max: 2000,
  });
  dim.height = toFiniteNumber(dim.height, {
    field: `${ctx}.dimensions.height`,
    min: 50,
    max: 1000,
  });
  dim.depth = toFiniteNumber(dim.depth, {
    field: `${ctx}.dimensions.depth`,
    min: 20,
    max: 500,
  });
}

/**
 * @param {unknown} item
 * @param {number} idx
 */
function validateManifold(item, idx) {
  const ctx = `manifold[${idx}]`;
  if (!isPlainObject(item)) {
    throw new Error(`Каталог: manifold[${idx}] должен быть объектом.`);
  }

  delete item.kind;
  delete item.catalogKey;

  item.model = sanitizeTrimAngleBrackets(item.model);
  if (!item.model) {
    throw new Error(`Каталог: model обязателен (${ctx}).`);
  }

  item.brand = sanitizeTrimAngleBrackets(item.brand);
  if (!item.brand) {
    throw new Error(`Каталог: brand обязателен (${ctx}).`);
  }

  item.article = sanitizeTrimAngleBrackets(item.article);
  if (!item.article) {
    throw new Error(`Каталог: article обязателен (${ctx}).`);
  }

  item.price = toFiniteNumber(item.price, {
    field: `${ctx}.price`,
    min: 1,
    max: 1_000_000_000,
  });

  item.outletsCount = toFiniteInteger(item.outletsCount, {
    field: `${ctx}.outletsCount`,
    min: 2,
    max: 32,
  });

  const appRaw = sanitizeTrimAngleBrackets(item.manifoldApplication).trim().toLowerCase();
  if (!MANIFOLD_APPLICATIONS_ALLOWED.includes(appRaw)) {
    throw new Error(
      `Каталог: ${ctx}.manifoldApplication недопустимо "${String(item.manifoldApplication)}"; ` +
        `разрешено: ${MANIFOLD_APPLICATIONS_ALLOWED.join(' | ')}.`,
    );
  }
  item.manifoldApplication = appRaw;

  if (typeof item.hasFlowMeters !== 'boolean') {
    throw new Error(`Каталог: ${ctx}.hasFlowMeters должен быть boolean.`);
  }

  if (item.manifoldApplication === 'underfloor' && item.hasFlowMeters !== true) {
    throw new Error(`Каталог: ${ctx} — для underfloor ожидается hasFlowMeters=true.`);
  }
  if (item.manifoldApplication === 'radiator' && item.hasFlowMeters !== false) {
    throw new Error(`Каталог: ${ctx} — для radiator в MVP ожидается hasFlowMeters=false.`);
  }

  item.material = sanitizeTrimAngleBrackets(item.material);
  if (!item.material) {
    throw new Error(`Каталог: material обязателен (${ctx}).`);
  }

  item.maxPressureBar = toFiniteNumber(item.maxPressureBar, {
    field: `${ctx}.maxPressureBar`,
    min: 0.1,
    max: 25,
  });
  item.maxTemperatureC = toFiniteNumber(item.maxTemperatureC, {
    field: `${ctx}.maxTemperatureC`,
    min: 30,
    max: 120,
  });

  item.connectionMainInch = normalizeInchLabel(item.connectionMainInch);
  if (!item.connectionMainInch) {
    throw new Error(`Каталог: connectionMainInch обязателен для коллектора (${ctx}).`);
  }

  item.connectionOutletsInch = normalizeInchLabel(item.connectionOutletsInch);
  if (!item.connectionOutletsInch) {
    throw new Error(`Каталог: connectionOutletsInch обязателен для коллектора (${ctx}).`);
  }

  validateManifoldDimensions(item, ctx);
  assertKnownManifoldSeriesGeometry(item, ctx);
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} ctx
 */
function validateBoilerManifoldDimensions(item, ctx) {
  if (!isPlainObject(item.dimensions)) {
    throw new Error(`Каталог: объект dimensions обязателен для котельного коллектора (${ctx}).`);
  }
  const dim = /** @type {Record<string, unknown>} */ (item.dimensions);
  dim.width = toFiniteNumber(dim.width, {
    field: `${ctx}.dimensions.width`,
    min: 100,
    max: 3000,
  });
  dim.height = toFiniteNumber(dim.height, {
    field: `${ctx}.dimensions.height`,
    min: 50,
    max: 1000,
  });
  dim.depth = toFiniteNumber(dim.depth, {
    field: `${ctx}.dimensions.depth`,
    min: 20,
    max: 500,
  });
}

/**
 * @param {unknown} item
 * @param {number} idx
 */
function validateBoilerManifold(item, idx) {
  const ctx = `boilerManifold[${idx}]`;
  if (!isPlainObject(item)) {
    throw new Error(`Каталог: boilerManifold[${idx}] должен быть объектом.`);
  }

  delete item.kind;
  delete item.catalogKey;

  item.model = sanitizeTrimAngleBrackets(item.model);
  if (!item.model) {
    throw new Error(`Каталог: model обязателен (${ctx}).`);
  }

  item.brand = sanitizeTrimAngleBrackets(item.brand);
  if (!item.brand) {
    throw new Error(`Каталог: brand обязателен (${ctx}).`);
  }

  item.article = sanitizeTrimAngleBrackets(item.article);
  if (!item.article) {
    throw new Error(`Каталог: article обязателен (${ctx}).`);
  }

  item.price = toFiniteNumber(item.price, {
    field: `${ctx}.price`,
    min: 1,
    max: 1_000_000_000,
  });

  item.circuitsCount = toFiniteInteger(item.circuitsCount, {
    field: `${ctx}.circuitsCount`,
    min: 1,
    max: 32,
  });

  item.maxPowerKw = toFiniteNumber(item.maxPowerKw, {
    field: `${ctx}.maxPowerKw`,
    min: 0.1,
    max: 500,
  });

  item.material = sanitizeTrimAngleBrackets(item.material);
  if (!item.material) {
    throw new Error(`Каталог: material обязателен (${ctx}).`);
  }

  if (typeof item.hasInsulation !== 'boolean') {
    throw new Error(`Каталог: ${ctx}.hasInsulation должен быть boolean.`);
  }

  item.interaxleDistanceMm = toFiniteNumber(item.interaxleDistanceMm, {
    field: `${ctx}.interaxleDistanceMm`,
    min: 50,
    max: 300,
  });

  item.connectionBoilerInch = normalizeInchLabel(item.connectionBoilerInch);
  if (!item.connectionBoilerInch) {
    throw new Error(`Каталог: connectionBoilerInch обязателен (${ctx}).`);
  }

  item.connectionCircuitsInch = normalizeInchLabel(item.connectionCircuitsInch);
  if (!item.connectionCircuitsInch) {
    throw new Error(`Каталог: connectionCircuitsInch обязателен (${ctx}).`);
  }

  item.maxPressureBar = toFiniteNumber(item.maxPressureBar, {
    field: `${ctx}.maxPressureBar`,
    min: 0.1,
    max: 25,
  });
  item.maxTemperatureC = toFiniteNumber(item.maxTemperatureC, {
    field: `${ctx}.maxTemperatureC`,
    min: 30,
    max: 120,
  });

  validateBoilerManifoldDimensions(item, ctx);
  assertKnownBoilerManifoldSeriesGeometry(item, ctx);
}

/** Допустимые конструкции унибокса. */
const UNIBOX_TYPES_ALLOWED = Object.freeze([
  'rtl_air',
  'rtl',
  'rtl_afc',
  'balancing_valve',
  'air_only',
]);

/** Резьба подключения унибокса. */
const UNIBOX_THREADS_ALLOWED = Object.freeze(['G1/2', 'G3/4']);

/** Тип фитинга унибокса. */
const UNIBOX_FITS_ALLOWED = Object.freeze(['eurocone', 'internal_thread']);

/**
 * Унибоксы: корень JSON или `products.uniboxes`.
 *
 * @param {Record<string, unknown>} json
 * @returns {unknown[]}
 */
function collectUniboxes(json) {
  if (Array.isArray(json.uniboxes)) return json.uniboxes;
  const p = json.products;
  if (isPlainObject(p) && Array.isArray(p.uniboxes)) return p.uniboxes;
  return [];
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} ctx
 * @param {string} minKey
 * @param {string} maxKey
 */
function assertOptionalMinMaxPair(item, ctx, minKey, maxKey) {
  const hasMin = item[minKey] != null;
  const hasMax = item[maxKey] != null;
  if (hasMin && !hasMax) {
    throw new Error(`Каталог: ${ctx}.${maxKey} обязателен, если задан ${minKey}.`);
  }
  if (hasMax && !hasMin) {
    throw new Error(`Каталог: ${ctx}.${minKey} обязателен, если задан ${maxKey}.`);
  }
  if (!hasMin || !hasMax) return;
  const min = /** @type {number} */ (item[minKey]);
  const max = /** @type {number} */ (item[maxKey]);
  if (min > max) {
    throw new Error(`Каталог: ${ctx}.${minKey} (${min}) не может быть больше ${maxKey} (${max}).`);
  }
}

/**
 * @param {unknown} item
 * @param {number} idx
 * @param {Set<string>} seenIds
 */
function validateUnibox(item, idx, seenIds) {
  const ctx = `uniboxes[${idx}]`;
  if (!isPlainObject(item)) {
    throw new Error(`Каталог: uniboxes[${idx}] должен быть объектом.`);
  }

  delete item.kind;
  delete item.catalogKey;
  delete item.currency;
  delete item.sku;
  delete item.article;
  delete item.maxWorkingPressureBar;
  delete item.kvs;
  delete item.kvValueM3h;
  delete item.maxPipeLengthM;
  delete item.maxTempC;
  delete item.mountDepthMm;
  delete item.purpose;
  delete item.headsCount;
  delete item.controlType;
  delete item.connectionDiameter;
  delete item.connectionType;

  // Запрет явных null в match-полях (omit вместо null).
  for (const key of Object.keys(item)) {
    if (item[key] === null) {
      throw new Error(`Каталог: ${ctx}.${key} не может быть null (уберите ключ).`);
    }
  }

  // Round-trip Mongo: id може прийти лише як uniboxId (Mongoose не зберігає id надійно).
  if (!item.id && item.uniboxId != null) {
    item.id = item.uniboxId;
  }
  delete item.uniboxId;

  item.id = sanitizeTrimAngleBrackets(item.id);
  if (!item.id) {
    throw new Error(`Каталог: id обязателен (${ctx}).`);
  }
  if (seenIds.has(item.id)) {
    throw new Error(`Каталог: дублирующий id унибокса "${item.id}" (${ctx}).`);
  }
  seenIds.add(item.id);

  item.brand = sanitizeTrimAngleBrackets(item.brand);
  if (!item.brand) {
    throw new Error(`Каталог: brand обязателен (${ctx}).`);
  }

  item.model = sanitizeTrimAngleBrackets(item.model);
  if (!item.model) {
    throw new Error(`Каталог: model обязателен (${ctx}).`);
  }

  const typeRaw = sanitizeTrimAngleBrackets(item.type).trim().toLowerCase();
  if (!UNIBOX_TYPES_ALLOWED.includes(typeRaw)) {
    throw new Error(
      `Каталог: ${ctx}.type недопустимо "${String(item.type)}"; ` +
        `разрешено: ${UNIBOX_TYPES_ALLOWED.join(' | ')}.`,
    );
  }
  item.type = typeRaw;

  item.loopsCount = toFiniteInteger(item.loopsCount, {
    field: `${ctx}.loopsCount`,
    min: 1,
    max: 8,
  });

  item.maxAreaSqM = toFiniteNumber(item.maxAreaSqM, {
    field: `${ctx}.maxAreaSqM`,
    min: 0.1,
    max: 500,
  });
  item.maxLoopLengthM = toFiniteNumber(item.maxLoopLengthM, {
    field: `${ctx}.maxLoopLengthM`,
    min: 0.1,
    max: 500,
  });
  item.maxTemperatureC = toFiniteNumber(item.maxTemperatureC, {
    field: `${ctx}.maxTemperatureC`,
    min: 30,
    max: 120,
  });
  item.maxPressureBar = toFiniteNumber(item.maxPressureBar, {
    field: `${ctx}.maxPressureBar`,
    min: 0.1,
    max: 25,
  });
  item.kvM3h = toFiniteNumber(item.kvM3h, {
    field: `${ctx}.kvM3h`,
    min: 0.01,
    max: 50,
  });

  item.price = toFiniteNumber(item.price, {
    field: `${ctx}.price`,
    min: 1,
    max: 1_000_000_000,
  });

  item.material = sanitizeTrimAngleBrackets(item.material);
  if (!item.material) {
    throw new Error(`Каталог: material обязателен (${ctx}).`);
  }

  if (!isPlainObject(item.connection)) {
    throw new Error(`Каталог: объект connection обязателен (${ctx}).`);
  }
  /** @type {Record<string, unknown>} */
  const conn = item.connection;
  const thread = sanitizeTrimAngleBrackets(conn.thread).trim().replace(/\s+/g, '');
  const threadNorm = thread === 'G½' || thread === 'G1/2"' ? 'G1/2' : thread === 'G¾' || thread === 'G3/4"' ? 'G3/4' : thread;
  if (!UNIBOX_THREADS_ALLOWED.includes(threadNorm)) {
    throw new Error(
      `Каталог: ${ctx}.connection.thread недопустимо "${String(conn.thread)}"; ` +
        `разрешено: ${UNIBOX_THREADS_ALLOWED.join(' | ')}.`,
    );
  }
  conn.thread = threadNorm;

  const fit = sanitizeTrimAngleBrackets(conn.fit).trim().toLowerCase();
  if (!UNIBOX_FITS_ALLOWED.includes(fit)) {
    throw new Error(
      `Каталог: ${ctx}.connection.fit недопустимо "${String(conn.fit)}"; ` +
        `разрешено: ${UNIBOX_FITS_ALLOWED.join(' | ')}.`,
    );
  }
  conn.fit = fit;

  if (item.description != null) {
    item.description = sanitizeTrimAngleBrackets(item.description);
    if (!item.description) delete item.description;
  }

  /** @type {string[]} */
  const optionalNumberKeys = [
    'minAirTempC',
    'maxAirTempC',
    'minCoolantTempC',
    'maxCoolantTempC',
    'minFlowLph',
    'maxFlowLph',
    'maxSupplyTempC',
  ];
  for (const key of optionalNumberKeys) {
    if (item[key] === undefined) continue;
    const min = key.startsWith('min') || key === 'maxSupplyTempC' ? -20 : -20;
    const max = key.includes('Flow') ? 5000 : 120;
    item[key] = toFiniteNumber(item[key], {
      field: `${ctx}.${key}`,
      min: key.includes('Flow') || key === 'maxSupplyTempC' ? (key.includes('Flow') ? 0.01 : 20) : min,
      max,
    });
  }

  assertOptionalMinMaxPair(item, ctx, 'minAirTempC', 'maxAirTempC');
  assertOptionalMinMaxPair(item, ctx, 'minCoolantTempC', 'maxCoolantTempC');
  assertOptionalMinMaxPair(item, ctx, 'minFlowLph', 'maxFlowLph');

  if (item.type === 'rtl_air') {
    for (const key of ['minAirTempC', 'maxAirTempC', 'minCoolantTempC', 'maxCoolantTempC']) {
      if (item[key] == null) {
        throw new Error(`Каталог: ${ctx}.${key} обязателен при type=rtl_air.`);
      }
    }
  } else if (item.type === 'rtl') {
    for (const key of ['minCoolantTempC', 'maxCoolantTempC']) {
      if (item[key] == null) {
        throw new Error(`Каталог: ${ctx}.${key} обязателен при type=rtl.`);
      }
    }
  } else if (item.type === 'rtl_afc') {
    for (const key of [
      'minCoolantTempC',
      'maxCoolantTempC',
      'minFlowLph',
      'maxFlowLph',
    ]) {
      if (item[key] == null) {
        throw new Error(`Каталог: ${ctx}.${key} обязателен при type=rtl_afc.`);
      }
    }
  } else if (item.type === 'air_only') {
    for (const key of ['minAirTempC', 'maxAirTempC', 'maxSupplyTempC']) {
      if (item[key] == null) {
        throw new Error(`Каталог: ${ctx}.${key} обязателен при type=air_only.`);
      }
    }
  } else if (item.type === 'balancing_valve') {
    for (const key of [
      'minAirTempC',
      'maxAirTempC',
      'minCoolantTempC',
      'maxCoolantTempC',
      'minFlowLph',
      'maxFlowLph',
      'maxSupplyTempC',
    ]) {
      if (item[key] != null) {
        throw new Error(
          `Каталог: ${ctx}.${key} недопустим при type=balancing_valve (в паспорте нет этих диапазонов).`,
        );
      }
    }
  }

  if (item.dimensions !== undefined) {
    if (!isPlainObject(item.dimensions)) {
      throw new Error(`Каталог: ${ctx}.dimensions должен быть объектом.`);
    }
    /** @type {Record<string, unknown>} */
    const dim = item.dimensions;
    dim.height = toFiniteNumber(dim.height, {
      field: `${ctx}.dimensions.height`,
      min: 0.1,
      max: 2000,
    });
    dim.width = toFiniteNumber(dim.width, {
      field: `${ctx}.dimensions.width`,
      min: 0.1,
      max: 2000,
    });
    dim.depth = toFiniteNumber(dim.depth, {
      field: `${ctx}.dimensions.depth`,
      min: 0.1,
      max: 500,
    });
  }
}

/**
 * Валидирует и (минимально) нормализует каталог.
 * Входной json не мутируется (клонирование как в validateAndNormalizeInput для calc).
 * @param {unknown} json
 * @returns {import('./types').NormalizedCatalog}
 */
export function validateAndNormalizeCatalog(json) {
  if (!isPlainObject(json)) throw new Error('Каталог: корневой JSON должен быть объектом.');
  /** @type {Record<string, unknown>} */
  const root = structuredClone(json);
  if (!isPlainObject(root.products)) throw new Error('Каталог: отсутствует объект products.');

  const boilers = isPlainObject(root.products.boilers) ? root.products.boilers : {};
  const doubleCircuit = Array.isArray(boilers.doubleCircuit) ? boilers.doubleCircuit : [];
  const singleCircuit = Array.isArray(boilers.singleCircuit) ? boilers.singleCircuit : [];

  doubleCircuit.forEach((b, i) => validateBoiler(b, `boilers.doubleCircuit[${i}]`, 2));
  singleCircuit.forEach((b, i) => validateBoiler(b, `boilers.singleCircuit[${i}]`, 1));

  const radiators = Array.isArray(root.products.radiators) ? root.products.radiators : [];
  radiators.forEach((r, i) => validateRadiator(r, i));

  const waterHeaters = Array.isArray(root.products.waterHeaters) ? root.products.waterHeaters : [];
  waterHeaters.forEach((h, i) => validateWaterHeater(h, i));

  const pipes = Array.isArray(root.products.pipes) ? root.products.pipes : [];
  const seenPipeIds = new Set();
  pipes.forEach((p, i) => validatePipe(p, i, seenPipeIds));

  const pumpsRaw = collectPumps(root);
  const pumps = pumpsRaw.filter(isPlainObject);
  const seenPumpIds = new Set();
  pumps.forEach((p, i) => validatePump(p, i, seenPumpIds));

  const indirectWaterHeatersRaw = collectIndirectWaterHeaters(root);
  const indirectWaterHeaters = indirectWaterHeatersRaw.filter(isPlainObject);
  indirectWaterHeaters.forEach((item, i) => validateIndirectWaterHeater(item, i));

  const manifoldsRaw = collectManifolds(root);
  const manifolds = manifoldsRaw.filter(isPlainObject);
  manifolds.forEach((item, i) => validateManifold(item, i));

  const boilerManifoldsRaw = collectBoilerManifolds(root);
  const boilerManifolds = boilerManifoldsRaw.filter(isPlainObject);
  boilerManifolds.forEach((item, i) => validateBoilerManifold(item, i));

  const uniboxesRaw = collectUniboxes(root);
  const uniboxes = uniboxesRaw.filter(isPlainObject);
  const seenUniboxIds = new Set();
  uniboxes.forEach((item, i) => validateUnibox(item, i, seenUniboxIds));

  return {
    boilers: { doubleCircuit, singleCircuit },
    radiators,
    waterHeaters,
    pipes,
    pumps,
    indirectWaterHeaters,
    manifolds,
    boilerManifolds,
    uniboxes,
  };
}

