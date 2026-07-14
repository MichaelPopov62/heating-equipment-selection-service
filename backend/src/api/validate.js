/**
 * Назначение: валидация и нормализация входной анкеты.
 * Описание: Фазы: reject legacy → compat-нормализация (room type, границы квартиры) → AJV strict
 * (coerceTypes: false) → cross-validation. Неизвестный room.type → 400 ROOM_TYPE_INVALID.
 * Экспортирует validateAndNormalizeInput().
 */

import AjvImport from 'ajv';
import {
  CANONICAL_ROOM_TYPES,
  ROOM_TYPE_SYNONYMS,
} from '../../../shared/roomTypeNormalization.js';
import {
  HOT_WATER_BOILER_MATCHING_SCHEME_ENUM,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from '../../../shared/heatingMatchingSchemes.js';
import {
  isUfhTerminalControl,
  resolveUfhTerminalControl,
} from '../../../shared/ufhTerminalControl.js';
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
import { assertCalcRuntimeContext } from '../reference/assertCalcRuntimeContext.js';
import { isPlainObject } from '../utils/isPlainObject.js';
import { logger } from '../utils/logger.js';
import { sanitizeTrimAngleBrackets } from '../utils/sanitizeString.js';
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

/** @type {typeof import('ajv').default} */
const Ajv = /** @type {typeof import('ajv').default} */ (
  /** @type {unknown} */ (AjvImport)
);

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
  coerceTypes: false,
  removeAdditional: true,
});

/**
 * Бросает Error с полями AppErrorLike (statusCode/code/details) для HTTP error handler.
 *
 * @param {string} message
 * @param {string} code
 * @param {import('../types/shared-types.js').ErrorDetailsAjvItem[]} [details]
 * @returns {never}
 */
function throwAppError(message, code, details) {
  const err = new Error(message);
  /** @type {import('../types/shared-types.js').AppErrorLike} */
  const appErr = err;
  appErr.statusCode = 400;
  appErr.code = code;
  if (details !== undefined) {
    appErr.details = details;
  }
  throw err;
}

const CANONICAL_ROOM_TYPE_SET = new Set(CANONICAL_ROOM_TYPES);

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
 * @param {unknown} body
 * @param {string} message
 */
function pushNormalizationWarning(body, message) {
  if (!body || typeof body !== 'object') return;
  const record = /** @type {Record<string, unknown>} */ (body);
  if (!record.heatingSystem || typeof record.heatingSystem !== 'object') {
    record.heatingSystem = {};
  }
  const hs = /** @type {Record<string, unknown>} */ (record.heatingSystem);
  const prev = Array.isArray(hs._normalizationWarnings) ? hs._normalizationWarnings : [];
  if (prev.includes(message)) return;
  hs._normalizationWarnings = [...prev, message];
}

/**
 * Compat-нормализация типа комнаты до AJV: trim, синонимы (исправление опечаток UI).
 * Неизвестное значение → 400 ROOM_TYPE_INVALID (без silent «помещение»).
 * Legacy-типы (living/bathroom/tech/жилое) больше не поддерживаются: их мигрирует клиент.
 *
 * @param {unknown} building
 * @returns {string[]} сообщения для heatingSystem._normalizationWarnings (после AJV)
 */
function normalizeRoomTypesBeforeValidate(building) {
  /** @type {string[]} */
  const compatWarnings = [];

  if (!building || typeof building !== 'object') return compatWarnings;
  const buildingRec = /** @type {Record<string, unknown>} */ (building);
  const rooms = buildingRec.rooms;
  if (!Array.isArray(rooms)) return compatWarnings;

  for (const r of rooms) {
    if (!isPlainObject(r) || r.type == null) continue;
    const raw = sanitizeRoomTypeString(r.type);
    const lower = raw.toLowerCase();
    const roomId = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : '?';

    /** @type {string | null} */
    let next;
    /** @type {string | null} */
    let compatSource = null;

    if (Object.prototype.hasOwnProperty.call(ROOM_TYPE_SYNONYMS, raw)) {
      const mapped = ROOM_TYPE_SYNONYMS[/** @type {keyof typeof ROOM_TYPE_SYNONYMS} */ (raw)];
      next = mapped ?? null;
      compatSource = raw;
    } else if (ROOM_TYPE_SYNONYM_BY_LOWER[lower] != null) {
      next = ROOM_TYPE_SYNONYM_BY_LOWER[lower] ?? null;
      compatSource = raw;
    } else {
      next = matchCanonicalRoomType(raw);
    }

    if (next == null) {
      throwAppError(
        `Неизвестный тип комнаты «${raw}» (room id=${roomId}). Допустимые значения — enum room.type в CalcInput.`,
        'ROOM_TYPE_INVALID',
      );
    }

    if (compatSource != null) {
      compatWarnings.push(
        `Тип комнаты «${roomId}»: «${compatSource}» нормализован до «${next}».`,
      );
    }

    r.type = next;
  }

  return compatWarnings;
}

/**
 * @param {unknown} body — распакованное тело запроса
 */
function rejectLegacyHotWaterFields(body) {
  if (!isPlainObject(body)) return;
  const hw = body.hotWater;
  if (!isPlainObject(hw)) return;

  if (Object.prototype.hasOwnProperty.call(hw, 'coldWaterC')) {
    throwAppError(
      'Поле hotWater.coldWaterC удалено. Задайте hotWater.coldWaterDesignSeason: «winter» (+5 °C) или «summer» (+15 °C).',
      'HOT_WATER_LEGACY_FIELD',
    );
  }

  const fx = hw.fixtures;
  if (isPlainObject(fx) && Object.prototype.hasOwnProperty.call(fx, 'kitchen')) {
    throwAppError(
      'Поле hotWater.fixtures.kitchen удалено. Используйте только kitchenSink.',
      'HOT_WATER_LEGACY_FIELD',
    );
  }
}

const INPUT_SCHEMA = await loadCalcInputSchemaForAjv();
const validateInput = ajv.compile(INPUT_SCHEMA);

// При старте процесса: в логах должно быть это сообщение. Если в ответе API по-прежнему
// фигурирует enum [жилое, санузел, living, …] — запущен старый процесс Node (перезапустите backend).
logger.info('validate.schema', null, {
  source: 'components/schemas/CalcInput.yaml',
  roomType: 'compat-then-strict-enum',
  ajvCoerceTypes: false,
  canonicalRoomTypes: CANONICAL_ROOM_TYPES,
});

/**
 * @param {unknown} input
 * @param {import('../types/shared-types.js').CalcRuntimeContext} ctx
 * @returns {import('../types/shared-types.js').CalcRequestBody}
 */
export function validateAndNormalizeInput(input, ctx) {
  assertCalcRuntimeContext(ctx);
  const rawClone = structuredClone(input ?? {});
  rejectLegacyHotWaterFields(rawClone);
  const draft = isPlainObject(rawClone) ? rawClone : {};
  const roomTypeCompatWarnings = normalizeRoomTypesBeforeValidate(draft.building);
  normalizeRoomBoundariesBeforeValidate(draft.building);
  // ТП комнаты: конструкция base+finish из data/ (статический слой, до AJV).
  normalizeUnderfloorHeatingBeforeValidate(rawClone);
  const ok = validateInput(rawClone);
  if (!ok) {
    /** @type {import('../types/shared-types.js').ErrorDetailsAjvItem[]} */
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
    throwAppError('Некорректные входные данные', 'VALIDATION_ERROR', details);
  }

  /** @type {import('../types/shared-types.js').CalcRequestBody} */
  const clone = /** @type {import('../types/shared-types.js').CalcRequestBody} */ (rawClone);

  for (const message of roomTypeCompatWarnings) {
    pushNormalizationWarning(clone, message);
  }

  // ГВС: сезон расчётной ХВ по умолчанию зима (+5 °C)
  if (isPlainObject(clone.hotWater)) {
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
  // Режим ТП: heatingSystem.ufhPresetId из ctx.ufhPresets (Mongo/file bundle).
  normalizeHeatingUfhPreset(clone, ctx.ufhPresets);
  appendThermalRegimeSchemeWarnings(clone);
  normalizeUnderfloorDistributionPreset(clone);

  // Санитизация строк: trim + базовая очистка опасных символов (< >),
  // чтобы случайные пробелы/вставки не ломали дальнейшую обработку или UI.
  if (clone.location?.address != null)
    clone.location.address = sanitizeTrimAngleBrackets(clone.location.address);

  for (const r of clone.building?.rooms ?? []) {
    if (r.id != null) r.id = sanitizeTrimAngleBrackets(r.id);
    if (r.name != null) r.name = sanitizeTrimAngleBrackets(r.name);
    if (r.type != null) {
      r.type = /** @type {import('../types/shared-types.js').RoomType} */ (
        sanitizeTrimAngleBrackets(r.type)
      );
    }
  }

  for (const e of clone.building?.envelopeElements ?? []) {
    if (e.roomId != null) e.roomId = sanitizeTrimAngleBrackets(e.roomId);
    if (e.name != null) e.name = sanitizeTrimAngleBrackets(e.name);
    if (e.construction != null) e.construction = sanitizeTrimAngleBrackets(e.construction);
    if (e.material != null) e.material = sanitizeTrimAngleBrackets(e.material);
    if (e.presetId != null) e.presetId = sanitizeTrimAngleBrackets(e.presetId);
  }

  // Cross-validation (базовая):
  // если заданы обе температуры подачи/обратки — обратка должна быть меньше подачи.
  if (
    clone.heatingSystem?.supplyC != null &&
    clone.heatingSystem?.returnC != null
  ) {
    if (!(clone.heatingSystem.returnC < clone.heatingSystem.supplyC)) {
      throwAppError(
        'Некорректный heatingSystem: returnC должен быть меньше supplyC.',
        'HEATING_SYSTEM_INVALID',
      );
    }
  }

  if (clone.hotWater?.hotWaterC != null) {
    const season =
      clone.hotWater.coldWaterDesignSeason === 'summer' ? 'summer' : 'winter';
    const effectiveColdC = season === 'summer' ? 15 : 5;
    if (!(effectiveColdC < clone.hotWater.hotWaterC)) {
      throwAppError(
        'Некорректный hotWater: расчётная ХВ по сезону должна быть ниже hotWaterC.',
        'HOT_WATER_TEMPS_INVALID',
      );
    }
  }

  assertBoilerDhwSchemeCompatibility(clone, ctx.appliances);

  assertBoilerPlacementAndBoilerRoom(clone, ctx.appliances);

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
 * Источник пресетов: data/warmFloorAssemblyPresets.js + data/flooringFinishMaterials.js.
 *
 * @param {unknown} input
 */
function normalizeUnderfloorHeatingBeforeValidate(input) {
  if (!input || typeof input !== 'object') return;
  const body = /** @type {import('../types/shared-types.js').CalcRequestBody} */ (input);
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
      throwAppError(
        `Неизвестная база ТП "${basePresetId}" (roomId="${room.id}").`,
        'UNDERFLOOR_HEATING_BASE_INVALID',
      );
    }
    if (!getFlooringFinishMaterialById(finishMaterialId)) {
      throwAppError(
        `Неизвестное финишное покрытие "${finishMaterialId}" (roomId="${room.id}").`,
        'UNDERFLOOR_HEATING_FINISH_INVALID',
      );
    }

    const rawSpacing = ufh.pipeSpacingMm;
    /** @type {100 | 150 | 200} */
    let pipeSpacingMm = 150;
    if (rawSpacing !== undefined && rawSpacing !== null) {
      const spacingNum = Number(rawSpacing);
      if (!Number.isFinite(spacingNum) || !Number.isInteger(spacingNum)) {
        throwAppError(
          `pipeSpacingMm: ожидается целое 100, 150 или 200 (roomId="${room.id}").`,
          'UNDERFLOOR_HEATING_PIPE_SPACING_INVALID',
        );
      }
      if (spacingNum !== 100 && spacingNum !== 150 && spacingNum !== 200) {
        throwAppError(
          `pipeSpacingMm=${spacingNum}: допустимы только 100, 150 или 200 мм (roomId="${room.id}").`,
          'UNDERFLOOR_HEATING_PIPE_SPACING_INVALID',
        );
      }
      pipeSpacingMm = /** @type {100 | 150 | 200} */ (spacingNum);
    }

    let furnitureOccupiedAreaM2 = 0;
    if (
      ufh.furnitureOccupiedAreaM2 !== undefined
      && ufh.furnitureOccupiedAreaM2 !== null
    ) {
      const furnitureNum = Number(ufh.furnitureOccupiedAreaM2);
      if (!Number.isFinite(furnitureNum) || furnitureNum < 0) {
        throwAppError(
          `furnitureOccupiedAreaM2: ожидается число ≥ 0 (roomId="${room.id}").`,
          'UNDERFLOOR_HEATING_FURNITURE_AREA_INVALID',
        );
      }
      furnitureOccupiedAreaM2 = furnitureNum;
    }

    const roomAreaM2 = Number(room.areaM2);
    if (
      Number.isFinite(roomAreaM2)
      && furnitureOccupiedAreaM2 >= roomAreaM2
    ) {
      throwAppError(
        `furnitureOccupiedAreaM2=${furnitureOccupiedAreaM2} м²: должно быть строго меньше площади комнаты ${roomAreaM2} м² (roomId="${room.id}").`,
        'UNDERFLOOR_HEATING_FURNITURE_AREA_INVALID',
      );
    }

    const rawTerminal = ufh.ufhTerminalControl;
    if (
      rawTerminal !== undefined
      && rawTerminal !== null
      && !isUfhTerminalControl(rawTerminal)
    ) {
      throwAppError(
        `ufhTerminalControl: ожидается "collector" или "unibox" (roomId="${room.id}").`,
        'UNDERFLOOR_HEATING_TERMINAL_INVALID',
      );
    }
    const ufhTerminalControl = resolveUfhTerminalControl(
      rawTerminal,
      roomAreaM2,
    );

    room.underfloorHeating = {
      enabled: true,
      basePresetId,
      finishMaterialId,
      pipeSpacingMm,
      ...(furnitureOccupiedAreaM2 > 0 ? { furnitureOccupiedAreaM2 } : {}),
      ...(ufhTerminalControl === 'unibox' ? { ufhTerminalControl: 'unibox' } : {}),
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
  const elements = /** @type {import('../types/shared-types.js').BuildingInput} */ (building)
    .envelopeElements;
  if (!Array.isArray(elements)) return;

  for (const el of elements) {
    if (el.kind !== 'floor') continue;
    const pid = typeof el.presetId === 'string' ? el.presetId.trim() : '';
    if (pid && ENVELOPE_FORBIDDEN_UFH_FLOOR_IDS.has(pid)) {
      throwAppError(
        `presetId "${pid}" — пресет сборки ТП; для теплопотерь используйте envelopePresets (kind=floor), для ТП — room.underfloorHeating.`,
        'ENVELOPE_FLOOR_PRESET_MIXED_WITH_UFH',
      );
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
  const b = /** @type {import('../types/shared-types.js').BuildingInput} */ (building);
  const rooms = b.rooms;
  if (!Array.isArray(rooms)) return;

  const om = b.objectMeta;
  const objectType =
    om?.objectType === 'apartment' || om?.objectType === 'house' ? om.objectType : 'house';

  if (objectType === 'apartment' && om) {
    // Единственная нормализация apartmentStackPosition в пайплайне (до derive границ).
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
  if (!isPlainObject(clone)) return;
  const body = /** @type {import('../types/shared-types.js').CalcRequestBody} */ (
    /** @type {unknown} */ (clone)
  );
  const building = body.building;
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
  if (!body.heatingSystem || typeof body.heatingSystem !== 'object') {
    body.heatingSystem = {};
  }
  const hs = /** @type {Record<string, unknown>} */ (body.heatingSystem);
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
  const building = /** @type {{ building?: import('../types/shared-types.js').BuildingInput }} */ (
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
  const building = /** @type {{ building?: import('../types/shared-types.js').BuildingInput }} */ (
    clone
  ).building;
  const v = building?.ventilation;
  if (!v || typeof v !== 'object') return;

  const flow = Number(v.flowM3PerHour);
  const n = Number(v.airChangesPerHour);
  const hasFlow = Number.isFinite(flow) && flow > 0;
  const hasN = Number.isFinite(n) && n > 0;
  if (!hasFlow && !hasN) return;

  throwAppError(
    'Поля building.ventilation.flowM3PerHour и airChangesPerHour в MVP не используются. ' +
      'Задайте building.objectMeta.ventilationReserveMode: natural (kVent 1.3) или recuperation (kVent 1.1).',
    'VENTILATION_LEGACY_FIELD',
  );
}

/**
 * Cross-validation: зона установки котла и объём котельной (дом).
 *
 * @param {unknown} clone
 * @param {import('../dhw/types.js').AppliancesBundle} appliances
 */
function assertBoilerPlacementAndBoilerRoom(clone, appliances) {
  if (!clone || typeof clone !== 'object') return;
  const building = /** @type {import('../types/shared-types.js').BuildingInput | undefined} */ (
    /** @type {{ building?: import('../types/shared-types.js').BuildingInput }} */ (clone).building
  );
  if (!building?.objectMeta || typeof building.objectMeta !== 'object') return;

  const om = /** @type {Record<string, unknown>} */ (
    /** @type {unknown} */ (building.objectMeta)
  );
  const objectType = resolveObjectType(
    /** @type {import('../types/shared-types.js').BuildingObjectMeta} */ (
      /** @type {unknown} */ (om)
    ),
  );

  if (objectType === 'apartment') {
    // apartmentStackPosition нормализуется в normalizeRoomBoundariesBeforeValidate (фаза 3).
    if (om.boilerPlacementZone != null) delete om.boilerPlacementZone;
    if (om.boilerRoomAreaM2 != null) delete om.boilerRoomAreaM2;
    if (om.ceilingHeightM != null) delete om.ceilingHeightM;
    if (om.indirectDhwSpaceAvailable === false) delete om.indirectDhwSpaceAvailable;
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
    throwAppError(
      'Для дома укажите building.objectMeta.boilerPlacementZone: kitchen, living_zone или boiler_room.',
      'BOILER_PLACEMENT_REQUIRED',
    );
  }

  if (zone !== 'boiler_room') {
    return;
  }

  const hasMetaArea = om.boilerRoomAreaM2 != null;
  const hasMetaHeight = om.ceilingHeightM != null;
  if (hasMetaArea !== hasMetaHeight) {
    throwAppError(
      'Укажите оба поля boilerRoomAreaM2 и ceilingHeightM либо добавьте комнату type=котельная в building.rooms.',
      'BOILER_ROOM_METRICS_INCOMPLETE',
    );
  }

  const mounting = appliances.byKind.boiler.mounting;

  const metrics = resolveBoilerRoomMetrics(
    building,
    /** @type {import('../types/shared-types.js').BuildingObjectMeta} */ (
      /** @type {unknown} */ (om)
    ),
    mounting,
  );

  if (!isBoilerRoomVolumeCompliant(metrics, mounting)) {
    throwAppError(
      `Для напольного котла в выделенной котельной нужен объём не менее ${mounting.minBoilerRoomVolumeM3} м³ и высота не менее ${mounting.minBoilerRoomHeightM} м (комната type=${getBoilerRoomType(mounting)} в rooms или boilerRoomAreaM2×ceilingHeightM).`,
      'BOILER_ROOM_VOLUME_INVALID',
    );
  }
}

/**
 * Нормализация связки котёл/ГВС и тип объекта после AJV (без 400 там, где достаточно авто-поправки).
 *
 * @param {unknown} clone — нормализованное тело запроса calc
 * @param {import('../dhw/types.js').AppliancesBundle} appliances
 */
function assertBoilerDhwSchemeCompatibility(clone, appliances) {
  if (!isPlainObject(clone)) return;
  const body = /** @type {import('../types/shared-types.js').CalcRequestBody} */ (
    /** @type {unknown} */ (clone)
  );
  const ot = body.building?.objectMeta?.objectType;
  const objectType = ot === 'apartment' ? 'apartment' : 'house';

  const hsEarly = body.heatingSystem;
  const scheme =
    isPlainObject(hsEarly) &&
    typeof hsEarly.hotWaterBoilerPowerMatchingScheme === 'string'
      ? hsEarly.hotWaterBoilerPowerMatchingScheme
      : HOT_WATER_BOILER_MATCHING_SCHEME_ENUM[0];

  // Квартира + одноконтурный с БКН: для малых — max-combi; для больших с местом под БКН — разрешено.
  if (scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM && objectType === 'apartment') {
    if (!body.heatingSystem || typeof body.heatingSystem !== 'object') {
      body.heatingSystem = {};
    }

    const building = body.building;
    const fixtures = body.hotWater?.fixtures;
    const isLarge = isLargeApartmentByInput(
      building,
      fixtures,
      appliances.byKind.boiler.apartmentClassification,
    );
    const hasSpace =
      building?.objectMeta?.indirectDhwSpaceAvailable === true;

    const hs = /** @type {Record<string, unknown>} */ (body.heatingSystem);

    if (!isLarge) {
      hs.hotWaterBoilerPowerMatchingScheme = SCHEME_BOILER_MAX_COMBI;
      hs._normalizationWarnings = [
        'Связка «Одноконтурный котёл + БКН» изменена на двухконтурную: для малых квартир БКН избыточен по габаритам.',
      ];
      return;
    }

    if (!hasSpace) {
      hs.hotWaterBoilerPowerMatchingScheme = SCHEME_BOILER_MAX_COMBI;
      hs._normalizationWarnings = [
        'Связка «1К + БКН» изменена на двухконтурную: укажите наличие места под бойлер (objectMeta.indirectDhwSpaceAvailable).',
      ];
      return;
    }

    hs._apartmentIndirectDhwStorage = true;
    return;
  }
}
