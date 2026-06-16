/**
 * Назначение: валидация и нормализация каталога.
 * Описание: проверка числовых полей, mountingType, типов оборудования и санитизация строк перед
 * использованием в формулах подбора; защита от NaN и физически некорректных значений.
 */
import { sanitizeTrimAngleBrackets } from '../utils/sanitizeString.js';
import { derivePipeModelLabel } from './pipeCatalogHelpers.js';

/** Прежнее имя функции: trim + убираем символы < > (см. sanitizeString). */
const toSafeString = sanitizeTrimAngleBrackets;

function isPlainObject(x) {
  return x != null && typeof x === 'object' && !Array.isArray(x);
}

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

/** Допустимые значения mountingType в каталоге (настенный / напольный). */
const BOILER_MOUNTING_WALL = 'wall';
const BOILER_MOUNTING_FLOOR = 'floor';

/**
 * Разбирает строку mountingType или тег (wall, floor, wall-mounted, floor-standing, настенный, напольный).
 * @param {unknown} raw
 * @returns {'wall' | 'floor' | null}
 */
function parseBoilerMountingTypeToken(raw) {
  const s = toSafeString(raw).toLowerCase().replace(/_/g, '-');
  if (!s) return null;
  if (s === 'wall' || s === 'wall-mounted' || s === 'настенный') return BOILER_MOUNTING_WALL;
  if (s === 'floor' || s === 'floor-standing' || s === 'напольный') return BOILER_MOUNTING_FLOOR;
  return null;
}

/**
 * @param {Record<string, unknown>} item
 * @returns {'wall' | 'floor' | null}
 */
function inferBoilerMountingTypeFromTags(item) {
  if (!Array.isArray(item.tags)) return null;
  for (const tag of item.tags) {
    const mt = parseBoilerMountingTypeToken(tag);
    if (mt) return mt;
  }
  return null;
}

/**
 * Нормализует mountingType: явное поле или теги wall-mounted / floor-standing.
 * @param {Record<string, unknown>} item
 * @param {string} ctx
 */
function applyBoilerMountingType(item, ctx) {
  const explicit =
    item.mountingType != null && toSafeString(item.mountingType) !== '';
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

  if (!toSafeString(item.fuel)) item.fuel = 'Газ';

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
    const tagSet = new Set(item.tags.map((t) => toSafeString(t).toLowerCase()));
    if (tagSet.has('double-circuit')) item.circuitsCount = 2;
    else if (tagSet.has('single-circuit')) item.circuitsCount = 1;
  }

  if (item.isDoubleCircuit !== true && item.isDoubleCircuit !== false) {
    const cc = item.circuitsCount;
    if (cc === 2) item.isDoubleCircuit = true;
    else if (cc === 1) item.isDoubleCircuit = false;
    else {
      const m = toSafeString(item.model).toLowerCase();
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

  // Монтаж: wall | floor — из поля или тегов (без ошибки, финальная проверка в validateBoiler).
  const mt =
    parseBoilerMountingTypeToken(item.mountingType) ?? inferBoilerMountingTypeFromTags(item);
  if (mt) item.mountingType = mt;
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
  const t = toSafeString(item.type).toLowerCase();
  if (t.includes('steel panel') || /\bpanel\b/.test(t)) return 'panel';
  const c = toSafeString(item.construction).toLowerCase();
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

  if (!toSafeString(item.material)) item.material = 'разное';

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

  item.model = toSafeString(item.model);
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

  item.fuel = toSafeString(item.fuel);
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
      .map((x) => toSafeString(x))
      .filter(Boolean);
  }

  if (item.combustionType != null) {
    const c = toSafeString(item.combustionType).toLowerCase();
    if (c === 'turbo' || c === 'atmospheric') item.combustionType = c;
    else delete item.combustionType;
  }

  item.type = toSafeString(item.type).toLowerCase();
  if (!item.type) {
    throw new Error(`Каталог: type обязателен (непустая строка) (${ctx}).`);
  }

  if (item.tags != null) {
    if (!Array.isArray(item.tags)) {
      throw new Error(`Каталог: tags должен быть массивом строк (${ctx}).`);
    }
    item.tags = item.tags.map((x) => toSafeString(x)).filter(Boolean);
  }

  if (item.priceSegment != null) {
    item.priceSegment = toSafeString(item.priceSegment).toLowerCase();
  }
}

function validateRadiator(item, idx) {
  if (!isPlainObject(item)) throw new Error(`Каталог: радиатор должен быть объектом (radiators[${idx}]).`);

  item.model = toSafeString(item.model);
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

  item.material = toSafeString(item.material);
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

  let priceBasis = toSafeString(item.priceBasis).toLowerCase();
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

  item.model = toSafeString(item.model);
  if (!item.model) throw new Error(`Каталог: model обязателен (waterHeaters[${idx}]).`);

  const typeRaw = item.type != null ? toSafeString(item.type).trim().toLowerCase() : '';
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
    item.heatingElementType = toSafeString(item.heatingElementType);
  }

  if (item.powerDetails != null) {
    item.powerDetails = toSafeString(item.powerDetails);
  }

  if (item.features != null) {
    if (!Array.isArray(item.features)) {
      throw new Error(`Каталог: features должен быть массивом строк (waterHeaters[${idx}]).`);
    }
    item.features = item.features.map((x) => toSafeString(x)).filter(Boolean);
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

  item.id = toSafeString(item.id);
  if (!item.id) {
    throw new Error(`Каталог: id обязателен (${ctx}).`);
  }
  if (seenIds.has(item.id)) {
    throw new Error(`Каталог: дубликат id="${item.id}" (${ctx}).`);
  }
  seenIds.add(item.id);

  item.brand = toSafeString(item.brand);
  if (!item.brand) {
    throw new Error(`Каталог: brand обязателен (${ctx}).`);
  }

  item.material = toSafeString(item.material);
  if (!item.material) {
    throw new Error(`Каталог: material обязателен (${ctx}).`);
  }

  if (item.category != null) {
    item.category = toSafeString(item.category);
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

  let model = toSafeString(item.model);
  if (!model) {
    model = derivePipeModelLabel(item, idx);
  }
  item.model = model;
  if (!item.model) {
    throw new Error(`Каталог: model обязателен (${ctx}).`);
  }
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
  const s = toSafeString(raw).trim().toLowerCase();
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

  item.model = toSafeString(item.model);
  if (!item.model) {
    throw new Error(`Каталог: model обязателен (indirectWaterHeaters[${idx}]).`);
  }

  if (item.brand != null) item.brand = toSafeString(item.brand);
  if (item.article != null) item.article = toSafeString(item.article);

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

  const indirectWaterHeatersRaw = collectIndirectWaterHeaters(root);
  const indirectWaterHeaters = indirectWaterHeatersRaw.filter(isPlainObject);
  indirectWaterHeaters.forEach((item, i) => validateIndirectWaterHeater(item, i));

  return {
    boilers: { doubleCircuit, singleCircuit },
    radiators,
    waterHeaters,
    pipes,
    indirectWaterHeaters,
  };
}

