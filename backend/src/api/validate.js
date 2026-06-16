/**
 * Назначение: валидация и нормализация входной анкеты.
 * Описание: Проверяет тело POST /api/v1/calc через AJV по схеме CalcInput.yaml (calcInputSchemaLoader.js), затем выполняет cross-validation: externalWalls, границы квартиры, схемы котёл/ГВС, монтаж котла. Нормализует типы комнат, температурный график и поля hotWater. Экспортирует validateAndNormalizeInput().
 */

import Ajv from 'ajv';
import {
  CANONICAL_ROOM_TYPES,
  LEGACY_ROOM_TYPE_MAP,
  ROOM_TYPE_SYNONYMS,
} from '../../../shared/roomTypeNormalization.js';
import {
  HOT_WATER_BOILER_MATCHING_SCHEME_ENUM,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from '../../../shared/heatingMatchingSchemes.js';
import {
  assertRoomExteriorLayoutWalls,
  normalizeRoomExteriorLayouts,
} from '../logic/roomExteriorLayoutHeatLoss.js';
import { normalizeHeatingSystemThermalRegime } from '../logic/heatingThermalRegimes.js';
import {
  normalizeHeatingUfhPreset,
  appendThermalRegimeSchemeWarnings,
} from '../logic/normalizeHeatingUfhPreset.js';
import { normalizeUnderfloorDistributionPreset } from '../logic/normalizeUnderfloorDistribution.js';
import { logger } from '../utils/logger.js';
import { sanitizeTrimAngleBrackets } from '../utils/sanitizeString.js';
import { getAppliances } from '../dhw/referenceCache.js';
import {
  getBoilerRoomType,
  isBoilerRoomVolumeCompliant,
  resolveBoilerRoomMetrics,
  resolveObjectType,
} from '../utils/boilerMountingConstraints.js';
import {
  isLargeApartmentByInput,
} from '../utils/apartmentMatching.js';
import { assertExternalWalls } from '../logic/externalWallsValidate.js';
import { normalizeVentilationReserveMode } from '../logic/ventilationReserve.js';
import {
  normalizeApartmentStackPosition,
  resolveApartmentRoomBoundaries,
  defaultHouseBottomBoundary,
  warnApartmentCeilingPresetMismatch,
} from '../logic/apartmentStackBoundaries.js';
import {
  getUnderfloorHeatingBasePresetById,
  LEGACY_MONOLITHIC_UFH_PRESET_MAP,
  resolveUnderfloorHeatingComposition,
  UNDERFLOOR_HEATING_BASE_PRESETS,
} from '../data/warmFloorAssemblyPresets.js';
import { getFlooringFinishMaterialById } from '../data/flooringFinishMaterials.js';
import { loadCalcInputSchemaForAjv } from './calcInputSchemaLoader.js';

const UNDERFLOOR_HEATING_BASE_PRESET_IDS = new Set(
  UNDERFLOOR_HEATING_BASE_PRESETS.map((p) => p.id),
);
const LEGACY_UFH_PRESET_IDS = new Set(Object.keys(LEGACY_MONOLITHIC_UFH_PRESET_MAP));
const ENVELOPE_FORBIDDEN_UFH_FLOOR_IDS = new Set([
  ...UNDERFLOOR_HEATING_BASE_PRESET_IDS,
  ...LEGACY_UFH_PRESET_IDS,
]);

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  removeAdditional: true,
});

const CANONICAL_ROOM_TYPE_SET = new Set(CANONICAL_ROOM_TYPES);

const LEGACY_ROOM_TYPE_BY_LOWER = Object.fromEntries(
  Object.entries(LEGACY_ROOM_TYPE_MAP).map(([k, v]) => [k.toLowerCase(), v]),
);

const ROOM_TYPE_SYNONYM_BY_LOWER = Object.fromEntries(
  Object.entries(ROOM_TYPE_SYNONYMS).map(([k, v]) => [k.toLowerCase(), v]),
);

/**
 * Точное или без учёта регистра совпадение с каноническим типом (кириллица/латиница).
 *
 * @param {string} raw
 * @returns {string | null}
 */
function matchCanonicalRoomType(raw) {
  if (CANONICAL_ROOM_TYPE_SET.has(raw)) return raw;
  const low = raw.toLowerCase();
  for (const c of CANONICAL_ROOM_TYPES) {
    if (c.toLowerCase() === low) return c;
  }
  return null;
}

/**
 * Убираем невидимые символы и приводим строку (без смены смысла кириллицы).
 *
 * @param {unknown} v
 * @returns {string}
 */
function sanitizeRoomTypeString(v) {
  try {
    return String(v)
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .replace(/[<>]/g, '');
  } catch {
    return String(v ?? '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .replace(/[<>]/g, '');
  }
}

/**
 * Нормализация типа комнаты до AJV: trim, синонимы, легаси, неизвестное → «помещение».
 *
 * @param {unknown} building
 */
function normalizeRoomTypesBeforeValidate(building) {
  if (!building || typeof building !== 'object') return;
  const rooms = building.rooms;
  if (!Array.isArray(rooms)) return;

  for (const r of rooms) {
    if (!r || typeof r !== 'object' || r.type == null) continue;
    const raw = sanitizeRoomTypeString(r.type);
    const lower = raw.toLowerCase();
    let next =
      ROOM_TYPE_SYNONYMS[raw] ??
      ROOM_TYPE_SYNONYM_BY_LOWER[lower] ??
      LEGACY_ROOM_TYPE_MAP[raw] ??
      LEGACY_ROOM_TYPE_BY_LOWER[lower] ??
      matchCanonicalRoomType(raw);
    if (next == null) next = 'помещение';
    r.type = next;
  }
}

/**
 * Страховка после AJV: любой тип вне справочника → «помещение».
 *
 * @param {unknown} building
 */
function assertCanonicalRoomTypes(building) {
  if (!building || typeof building !== 'object') return;
  const rooms = building.rooms;
  if (!Array.isArray(rooms)) return;
  for (const r of rooms) {
    if (!r || typeof r !== 'object') continue;
    if (!CANONICAL_ROOM_TYPE_SET.has(r.type)) {
      r.type = 'помещение';
    }
  }
}

/**
 * Явный отказ от удалённых полей горячей воды (до AJV, чтобы клиент получил понятное сообщение).
 *
 * @param {unknown} body — распакованное тело запроса
 */
function rejectLegacyHotWaterFields(body) {
  const hw = body?.hotWater;
  if (!hw || typeof hw !== 'object') return;

  if (Object.prototype.hasOwnProperty.call(hw, 'coldWaterC')) {
    const err = new Error(
      'Поле hotWater.coldWaterC удалено. Задайте hotWater.coldWaterDesignSeason: «winter» (+5 °C) или «summer» (+15 °C).',
    );
    err.statusCode = 400;
    err.code = 'HOT_WATER_LEGACY_FIELD';
    throw err;
  }

  const fx = hw.fixtures;
  if (
    fx &&
    typeof fx === 'object' &&
    Object.prototype.hasOwnProperty.call(fx, 'kitchen')
  ) {
    const err = new Error(
      'Поле hotWater.fixtures.kitchen удалено. Используйте только kitchenSink.',
    );
    err.statusCode = 400;
    err.code = 'HOT_WATER_LEGACY_FIELD';
    throw err;
  }
}

const INPUT_SCHEMA = await loadCalcInputSchemaForAjv();
const validateInput = ajv.compile(INPUT_SCHEMA);

// При старте процесса: в логах должно быть это сообщение. Если в ответе API по-прежнему
// фигурирует enum [жилое, санузел, living, …] — запущен старый процесс Node (перезапустите backend).
logger.info('validate.schema', null, {
  source: 'components/schemas/CalcInput.yaml',
  roomType: 'normalize-then-string',
  canonicalRoomTypes: CANONICAL_ROOM_TYPES,
});

/**
 * @param {unknown} input
 * @returns {import('../types/shared-types').CalcRequestBody}
 */
export function validateAndNormalizeInput(input) {
  const clone = structuredClone(input ?? {});
  rejectLegacyHotWaterFields(clone);
  normalizeRoomTypesBeforeValidate(clone.building);
  normalizeRoomBoundariesBeforeValidate(clone.building);
  normalizeUnderfloorHeatingBeforeValidate(clone);
  const ok = validateInput(clone);
  if (!ok) {
    /** @type {import('../types/shared-types').ErrorDetailsAjvItem[]} */
    const details = validateInput.errors ?? [];
    const short = details.slice(0, 5).map((e) => ({
      instancePath: e.instancePath,
      message: e.message,
      keyword: e.keyword,
    }));
    logger.warn('validation.failed', null, {
      code: 'VALIDATION_ERROR',
      errors: short,
    });
    const err = new Error('Некорректные входные данные');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    err.details = details;
    throw err;
  }

  assertCanonicalRoomTypes(clone.building);

  // ГВС: сезон расчётной ХВ по умолчанию зима (+5 °C)
  if (clone.hotWater && typeof clone.hotWater === 'object') {
    if (clone.hotWater.coldWaterDesignSeason == null) {
      clone.hotWater.coldWaterDesignSeason = 'winter';
    }
  }

  // Нормализация температур: поддерживаем оба варианта,
  // но каноническое расположение — building.temps.
  if (clone.building?.temps == null && clone.temps != null) {
    clone.building.temps = clone.temps;
  }

  // График отопления и база ΔT каталога радиатора по пресету (или 75/65 по умолчанию).
  normalizeHeatingSystemThermalRegime(clone);
  normalizeHeatingUfhPreset(clone);
  appendThermalRegimeSchemeWarnings(clone);
  normalizeUnderfloorDistributionPreset(clone);

  // Санитизация строк: trim + базовая очистка опасных символов (< >),
  // чтобы случайные пробелы/вставки не ломали дальнейшую обработку или UI.
  const safeStr = sanitizeTrimAngleBrackets;

  if (clone.location?.address != null)
    clone.location.address = safeStr(clone.location.address);

  for (const r of clone.building?.rooms ?? []) {
    if (r.id != null) r.id = safeStr(r.id);
    if (r.name != null) r.name = safeStr(r.name);
    if (r.type != null) r.type = safeStr(r.type);
  }

  for (const e of clone.building?.envelopeElements ?? []) {
    if (e.roomId != null) e.roomId = safeStr(e.roomId);
    if (e.name != null) e.name = safeStr(e.name);
    if (e.construction != null) e.construction = safeStr(e.construction);
    if (e.material != null) e.material = safeStr(e.material);
    if (e.presetId != null) e.presetId = safeStr(e.presetId);
  }

  // Cross-validation (базовая):
  // если заданы обе температуры подачи/обратки — обратка должна быть меньше подачи.
  if (
    clone.heatingSystem?.supplyC != null &&
    clone.heatingSystem?.returnC != null
  ) {
    if (!(clone.heatingSystem.returnC < clone.heatingSystem.supplyC)) {
      const err = new Error(
        'Некорректный heatingSystem: returnC должен быть меньше supplyC.',
      );
      err.statusCode = 400;
      err.code = 'HEATING_SYSTEM_INVALID';
      throw err;
    }
  }

  if (clone.hotWater?.hotWaterC != null) {
    const season =
      clone.hotWater.coldWaterDesignSeason === 'summer' ? 'summer' : 'winter';
    const effectiveColdC = season === 'summer' ? 15 : 5;
    if (!(effectiveColdC < clone.hotWater.hotWaterC)) {
      const err = new Error(
        'Некорректный hotWater: расчётная ХВ по сезону должна быть ниже hotWaterC.',
      );
      err.statusCode = 400;
      err.code = 'HOT_WATER_TEMPS_INVALID';
      throw err;
    }
  }

  assertBoilerDhwSchemeCompatibility(clone);

  assertBoilerPlacementAndBoilerRoom(clone);

  assertExternalWalls(clone.building);

  normalizeRoomExteriorLayouts(clone.building);
  assertRoomExteriorLayoutWalls(clone.building);

  assertEnvelopeFloorPresetsNotUnderfloorHeating(clone.building);

  normalizeObjectMetaVentilationReserve(clone);

  assertVentilationLegacyFieldsDisabled(clone);

  collectApartmentEnvelopeWarnings(clone);

  return clone;
}

/**
 * Убирает underfloorHeating, если ТП выключен глобально; нормализует base + finish.
 *
 * @param {unknown} input
 */
function normalizeUnderfloorHeatingBeforeValidate(input) {
  if (!input || typeof input !== 'object') return;
  const body = /** @type {import('../types/shared-types').CalcRequestBody} */ (input);
  const rooms = body.building?.rooms;
  if (!Array.isArray(rooms)) return;

  const globalUfh =
    Boolean(body.heatingSystem?.waterUnderfloorHeating) ||
    Boolean(body.heatingSystem?.ufhPresetId);

  for (const room of rooms) {
    if (!globalUfh) {
      delete room.underfloorHeating;
      continue;
    }
    const ufh = room.underfloorHeating;
    if (!ufh || ufh.enabled !== true) {
      delete room.underfloorHeating;
      continue;
    }

    const composed = resolveUnderfloorHeatingComposition(ufh);
    if (!composed) {
      delete room.underfloorHeating;
      continue;
    }

    const { basePresetId, finishMaterialId } = composed;
    if (!getUnderfloorHeatingBasePresetById(basePresetId)) {
      const err = new Error(
        `Неизвестная база ТП "${basePresetId}" (roomId="${room.id}").`,
      );
      err.statusCode = 400;
      err.code = 'UNDERFLOOR_HEATING_BASE_INVALID';
      throw err;
    }
    if (!getFlooringFinishMaterialById(finishMaterialId)) {
      const err = new Error(
        `Неизвестное финишное покрытие "${finishMaterialId}" (roomId="${room.id}").`,
      );
      err.statusCode = 400;
      err.code = 'UNDERFLOOR_HEATING_FINISH_INVALID';
      throw err;
    }

    const rawSpacing = ufh.pipeSpacingMm;
    let pipeSpacingMm = 150;
    if (rawSpacing !== undefined && rawSpacing !== null) {
      const spacingNum = Number(rawSpacing);
      if (!Number.isFinite(spacingNum) || !Number.isInteger(spacingNum)) {
        const err = new Error(
          `pipeSpacingMm: ожидается целое 100, 150 или 200 (roomId="${room.id}").`,
        );
        err.statusCode = 400;
        err.code = 'UNDERFLOOR_HEATING_PIPE_SPACING_INVALID';
        throw err;
      }
      if (spacingNum !== 100 && spacingNum !== 150 && spacingNum !== 200) {
        const err = new Error(
          `pipeSpacingMm=${spacingNum}: допустимы только 100, 150 или 200 мм (roomId="${room.id}").`,
        );
        err.statusCode = 400;
        err.code = 'UNDERFLOOR_HEATING_PIPE_SPACING_INVALID';
        throw err;
      }
      pipeSpacingMm = spacingNum;
    }

    room.underfloorHeating = {
      enabled: true,
      basePresetId,
      finishMaterialId,
      pipeSpacingMm,
    };
  }
}

/**
 * floorPresetId в envelopeElements не должен ссылаться на сборки ТП.
 *
 * @param {unknown} building
 */
function assertEnvelopeFloorPresetsNotUnderfloorHeating(building) {
  if (!building || typeof building !== 'object') return;
  const elements = /** @type {import('../types/shared-types').BuildingInput} */ (building)
    .envelopeElements;
  if (!Array.isArray(elements)) return;

  for (const el of elements) {
    if (el.kind !== 'floor') continue;
    const pid = typeof el.presetId === 'string' ? el.presetId.trim() : '';
    if (pid && ENVELOPE_FORBIDDEN_UFH_FLOOR_IDS.has(pid)) {
      const err = new Error(
        `presetId "${pid}" — пресет сборки ТП; для теплопотерь используйте envelopePresets (kind=floor), для ТП — room.underfloorHeating.`,
      );
      err.statusCode = 400;
      err.code = 'ENVELOPE_FLOOR_PRESET_MIXED_WITH_UFH';
      throw err;
    }
  }
}

/**
 * Границы комнат до AJV: bottomBoundary обязателен в схеме.
 *
 * @param {unknown} building
 */
function normalizeRoomBoundariesBeforeValidate(building) {
  if (!building || typeof building !== 'object') return;
  const b = /** @type {import('../types/shared-types').BuildingInput} */ (building);
  const rooms = b.rooms;
  if (!Array.isArray(rooms)) return;

  const om = b.objectMeta;
  const objectType =
    om?.objectType === 'apartment' || om?.objectType === 'house' ? om.objectType : 'house';

  if (objectType === 'apartment' && om) {
    om.apartmentStackPosition = normalizeApartmentStackPosition(om.apartmentStackPosition);
    const maxF = om.floors ?? 1;
    for (const r of rooms) {
      if (!r || typeof r !== 'object') continue;
      const floorNum = Math.max(1, Math.min(3, Math.trunc(Number(r.floor) || 1)));
      const floor = /** @type {1 | 2 | 3} */ (floorNum === 2 ? 2 : floorNum === 3 ? 3 : 1);
      const bounds = resolveApartmentRoomBoundaries(
        om.apartmentStackPosition,
        floor,
        maxF,
      );
      r.bottomBoundary = bounds.bottomBoundary;
      if (r.topBoundary !== 'roof') {
        r.topBoundary = bounds.topBoundary;
      }
    }
    return;
  }

  for (const r of rooms) {
    if (!r || typeof r !== 'object') continue;
    if (r.bottomBoundary !== 'heated' && r.bottomBoundary !== 'unheated') {
      r.bottomBoundary = defaultHouseBottomBoundary(r.floor);
    }
  }
}

/**
 * Предупреждения по пресетам потолка квартиры (в heatingSystem._normalizationWarnings).
 *
 * @param {unknown} clone
 */
function collectApartmentEnvelopeWarnings(clone) {
  if (!clone || typeof clone !== 'object') return;
  const building = /** @type {import('../types/shared-types').BuildingInput | undefined} */ (
    /** @type {{ building?: import('../types/shared-types').BuildingInput }} */ (clone).building
  );
  if (building?.objectMeta?.objectType !== 'apartment') return;

  /** @type {string[]} */
  const warns = [];
  const elements = building.envelopeElements ?? [];
  const roomsById = new Map((building.rooms ?? []).map((r) => [r.id, r]));

  for (const el of elements) {
    if (!el || typeof el !== 'object') continue;
    if (el.kind !== 'ceiling') continue;
    const room = roomsById.get(String(el.roomId ?? ''));
    if (!room) continue;
    const msg = warnApartmentCeilingPresetMismatch(room.topBoundary, el.presetId);
    if (msg) warns.push(msg);
  }

  if (warns.length === 0) return;
  if (!clone.heatingSystem || typeof clone.heatingSystem !== 'object') {
    clone.heatingSystem = {};
  }
  const hs = /** @type {Record<string, unknown>} */ (clone.heatingSystem);
  const prev = Array.isArray(hs._normalizationWarnings) ? hs._normalizationWarnings : [];
  hs._normalizationWarnings = [...prev, ...warns];
}

/**
 * Дефолт режима вентиляции для MVP (kVent по комнатам).
 *
 * @param {unknown} clone
 */
function normalizeObjectMetaVentilationReserve(clone) {
  if (!clone || typeof clone !== 'object') return;
  const building = /** @type {{ building?: import('../types/shared-types').BuildingInput }} */ (
    clone
  ).building;
  if (!building?.objectMeta || typeof building.objectMeta !== 'object') return;
  building.objectMeta.ventilationReserveMode = normalizeVentilationReserveMode(
    building.objectMeta.ventilationReserveMode,
  );
}

/**
 * MVP: расход L / кратность n на здание не используются — только kVent по комнатам.
 *
 * @param {unknown} clone
 */
function assertVentilationLegacyFieldsDisabled(clone) {
  if (!clone || typeof clone !== 'object') return;
  const building = /** @type {{ building?: import('../types/shared-types').BuildingInput }} */ (
    clone
  ).building;
  const v = building?.ventilation;
  if (!v || typeof v !== 'object') return;

  const flow = Number(v.flowM3PerHour);
  const n = Number(v.airChangesPerHour);
  const hasFlow = Number.isFinite(flow) && flow > 0;
  const hasN = Number.isFinite(n) && n > 0;
  if (!hasFlow && !hasN) return;

  const err = new Error(
    'Поля building.ventilation.flowM3PerHour и airChangesPerHour в MVP не используются. ' +
      'Задайте building.objectMeta.ventilationReserveMode: natural (kVent 1.3) или recuperation (kVent 1.1).',
  );
  err.statusCode = 400;
  err.code = 'VENTILATION_LEGACY_FIELD';
  throw err;
}

/**
 * Cross-validation: зона установки котла и объём котельной (дом).
 *
 * @param {unknown} clone
 */
function assertBoilerPlacementAndBoilerRoom(clone) {
  if (!clone || typeof clone !== 'object') return;
  const building = /** @type {import('../types/shared-types').BuildingInput | undefined} */ (
    /** @type {{ building?: import('../types/shared-types').BuildingInput }} */ (clone).building
  );
  if (!building?.objectMeta || typeof building.objectMeta !== 'object') return;

  const om = /** @type {Record<string, unknown>} */ (
    /** @type {import('../types/shared-types').BuildingObjectMeta} */ (building.objectMeta)
  );
  const objectType = resolveObjectType(
    /** @type {import('../types/shared-types').BuildingObjectMeta} */ (om),
  );

  if (objectType === 'apartment') {
    if (om.boilerPlacementZone != null) delete om.boilerPlacementZone;
    if (om.boilerRoomAreaM2 != null) delete om.boilerRoomAreaM2;
    if (om.ceilingHeightM != null) delete om.ceilingHeightM;
    if (om.indirectDhwSpaceAvailable === false) delete om.indirectDhwSpaceAvailable;
    om.apartmentStackPosition = normalizeApartmentStackPosition(om.apartmentStackPosition);
    return;
  }

  if (om.apartmentStackPosition != null) delete om.apartmentStackPosition;

  if (om.indirectDhwSpaceAvailable != null) delete om.indirectDhwSpaceAvailable;

  if (om.boilerPlacementZone == null || om.boilerPlacementZone === '') {
    om.boilerPlacementZone = 'kitchen';
  }

  const zone = om.boilerPlacementZone;
  if (
    typeof zone !== 'string' ||
    !['kitchen', 'living_zone', 'boiler_room'].includes(zone)
  ) {
    const err = new Error(
      'Для дома укажите building.objectMeta.boilerPlacementZone: kitchen, living_zone или boiler_room.',
    );
    err.statusCode = 400;
    err.code = 'BOILER_PLACEMENT_REQUIRED';
    throw err;
  }

  if (zone !== 'boiler_room') {
    return;
  }

  const hasMetaArea = om.boilerRoomAreaM2 != null;
  const hasMetaHeight = om.ceilingHeightM != null;
  if (hasMetaArea !== hasMetaHeight) {
    const err = new Error(
      'Укажите оба поля boilerRoomAreaM2 и ceilingHeightM либо добавьте комнату type=котельная в building.rooms.',
    );
    err.statusCode = 400;
    err.code = 'BOILER_ROOM_METRICS_INCOMPLETE';
    throw err;
  }

  const metrics = resolveBoilerRoomMetrics(
    building,
    /** @type {import('../types/shared-types').BuildingObjectMeta} */ (om),
  );

  if (!isBoilerRoomVolumeCompliant(metrics)) {
    const m = getAppliances().byKind.boiler.mounting;
    const err = new Error(
      `Для напольного котла в выделенной котельной нужен объём не менее ${m.minBoilerRoomVolumeM3} м³ и высота не менее ${m.minBoilerRoomHeightM} м (комната type=${getBoilerRoomType()} в rooms или boilerRoomAreaM2×ceilingHeightM).`,
    );
    err.statusCode = 400;
    err.code = 'BOILER_ROOM_VOLUME_INVALID';
    throw err;
  }
}

/**
 * Нормализация связки котёл/ГВС и тип объекта после AJV (без 400 там, где достаточно авто-поправки).
 *
 * @param {unknown} clone — нормализованное тело запроса calc
 */
function assertBoilerDhwSchemeCompatibility(clone) {
  if (!clone || typeof clone !== 'object') return;
  const ot = /** @type {{ building?: { objectMeta?: { objectType?: string } } }} */ (
    clone
  ).building?.objectMeta?.objectType;
  const objectType = ot === 'apartment' ? 'apartment' : 'house';

  const hsEarly =
    /** @type {{ heatingSystem?: Record<string, unknown> }} */ (clone).heatingSystem;
  const scheme =
    hsEarly &&
    typeof hsEarly === 'object' &&
    typeof hsEarly.hotWaterBoilerPowerMatchingScheme === 'string'
      ? hsEarly.hotWaterBoilerPowerMatchingScheme
      : HOT_WATER_BOILER_MATCHING_SCHEME_ENUM[0];

  // Квартира + одноконтурный с БКН: для малых — max-combi; для больших с местом под БКН — разрешено.
  if (scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM && objectType === 'apartment') {
    if (!clone.heatingSystem || typeof clone.heatingSystem !== 'object') {
      clone.heatingSystem = {};
    }

    const building = /** @type {{ building?: import('../types/shared-types').BuildingInput }} */ (
      clone
    ).building;
    const fixtures = /** @type {{ hotWater?: { fixtures?: import('../types/shared-types').HotWaterFixturesInput } }} */ (
      clone
    ).hotWater?.fixtures;
    const isLarge = isLargeApartmentByInput(building, fixtures);
    const hasSpace =
      building?.objectMeta?.indirectDhwSpaceAvailable === true;

    if (!isLarge) {
      clone.heatingSystem.hotWaterBoilerPowerMatchingScheme =
        SCHEME_BOILER_MAX_COMBI;
      clone.heatingSystem._normalizationWarnings = [
        'Связка «Одноконтурный котёл + БКН» изменена на двухконтурную: для малых квартир БКН избыточен по габаритам.',
      ];
      return;
    }

    if (!hasSpace) {
      clone.heatingSystem.hotWaterBoilerPowerMatchingScheme =
        SCHEME_BOILER_MAX_COMBI;
      clone.heatingSystem._normalizationWarnings = [
        'Связка «1К + БКН» изменена на двухконтурную: укажите наличие места под бойлер (objectMeta.indirectDhwSpaceAvailable).',
      ];
      return;
    }

    /** @type {Record<string, unknown>} */ (clone.heatingSystem)._apartmentIndirectDhwStorage =
      true;
    return;
  }
}
