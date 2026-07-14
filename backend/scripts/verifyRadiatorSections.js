/**
 * Назначение: dev-скрипт проверки расчёта секций радиаторов.
 * Описание: Контракт v3 (docs/heating-schemes-thermal-regime.md):
 * 1) primary/auto — по выбранному графику анкеты (75/65 → 3 сек), без мутации input;
 * 2) 55/45 (6 сек) — только при явном condensing_dt30_55_45 в input / lineEfficient;
 * 3) condensing-котёл + традиционный график → warning в отчёте (plain text, без кода REC_*).
 * Запуск: cd backend && npm run verify:radiator-sections
 */

import { warmupReferenceCache, getReferenceBundle, toCalcRuntimeContext } from '../src/reference/public.js';
import { validateAndNormalizeInput } from '../src/api/validate.js';
import { matchEquipment } from '../src/matching/index.js';
import { pickRadiators } from './utils/radiatorHelpers.js';
import { calculateHeatLossForBuilding } from '../src/logic/heatlossByRooms.js';
import { calculateHotWaterDemand } from '../src/logic/hotWater.js';
import { resolveKVent } from '../src/logic/ventilationReserve.js';
import { buildReport } from '../src/report/buildReport.js';
import { HEATING_THERMAL_REGIME_PRESET_ENUM } from '../src/logic/heatingThermalRegimes.js';
import { adjustOutputWatts } from '../src/matching/radiatorSizingHelpers.js';
import { assertAt, assertDefined } from './fixtures/scriptAssert.js';

/** @typedef {import('../src/types/shared-types.js').HeatLossReport} HeatLossReport */
/** @typedef {import('../src/types/shared-types.js').HotWaterReport} HotWaterReport */
/** @typedef {import('../src/types/shared-types.js').HeatingSystemInput} HeatingSystemInput */
/** @typedef {import('../src/types/shared-types.js').BuildingInput} BuildingInput */
/** @typedef {import('../src/types/shared-types.js').CalcRuntimeContext} CalcRuntimeContext */
/** @typedef {import('../src/types/shared-types.js').CalcRequestBody} CalcRequestBody */

/** Typed wrapper: JSDoc matchEquipment объявлен как `{ object }`, ломая вывод аргументов. */
const matchEquipmentTyped = /** @type {(args: {
 *   heatLoss: HeatLossReport,
 *   hotWater: HotWaterReport,
 *   heatingSystem: HeatingSystemInput,
 *   building?: BuildingInput,
 *   ctx: CalcRuntimeContext,
 * }) => ReturnType<typeof matchEquipment>} */ (matchEquipment);

/**
 * @param {CalcRequestBody} body
 * @returns {import('../src/types/shared-types.js').HotWaterInput & { objectType?: string }}
 */
function hotWaterInputFromCalcBody(body) {
  /** @type {import('../src/types/shared-types.js').HotWaterInput & { objectType?: string }} */
  const hwInput = { ...(body.hotWater ?? {}) };
  const objectType = body.building?.objectMeta?.objectType;
  if (objectType === 'apartment' || objectType === 'house') {
    hwInput.objectType = objectType;
  }
  return hwInput;
}

/** Ожидаемые секции для фикстуры r1 при file-каталоге (75/65 и 55/45). */
const FIXTURE_SECTIONS_TRADITIONAL = 3;
const FIXTURE_SECTIONS_CONDENSING = 6;

/**
 * @param {{ supplyC: number; returnC: number; insideC: number }} args
 * @returns {number}
 */
function deltaTmeanK({ supplyC, returnC, insideC }) {
  return (supplyC + returnC) / 2 - insideC;
}

/**
 * @param {number} qEnvelope
 * @param {import('../src/logic/ventilationReserve.js').VentilationReserveMode | undefined} ventilationMode
 * @param {number} baseWatts
 * @param {50 | 70} baseDeltaT
 * @param {number} supplyC
 * @param {number} returnC
 * @param {number} [insideC]
 */
function expectedSections(
  qEnvelope,
  ventilationMode,
  baseWatts,
  baseDeltaT,
  supplyC,
  returnC,
  insideC = 20,
) {
  const targetDeltaT = deltaTmeanK({ supplyC, returnC, insideC });
  const adjusted = adjustOutputWatts({ baseWatts, baseDeltaT, targetDeltaT });
  const kVent = resolveKVent(ventilationMode);
  const qRad = qEnvelope * kVent;
  return {
    sections: Math.ceil(qRad / adjusted),
    adjustedWatts: adjusted,
    targetDeltaT,
    kVent,
    qRad,
  };
}

/** @param {boolean} ok @param {string} label @param {string} [detail] */
function logCheck(ok, label, detail = '') {
  const suffix = detail ? ` ${detail}` : '';
  console.log(ok ? 'OK' : 'FAIL', '—', label + suffix);
  return ok;
}

/** Минимально валидное тело запроса для проверок. */
function minimalCalcBody(overrides = {}) {
  return structuredClone({
    building: {
      objectMeta: {
        objectType: 'apartment',
        floors: 1,
        roomsCount: 1,
        externalWalls: { presetId: 'wall_gas_concrete_d500' },
      },
      rooms: [
        {
          id: 'r1',
          name: 'Гостиная',
          type: 'гостиная',
          floor: 1,
          topBoundary: 'heated',
          areaM2: 25,
          heightM: 2.7,
        },
      ],
      envelopeElements: [
        {
          kind: 'wall',
          roomId: 'r1',
          construction: 'наружная стена',
          areaM2: 30,
          uValue: 0.35,
        },
      ],
      temps: { insideC: 20, outsideC: -5 },
    },
    temps: { insideC: 20, outsideC: -5 },
    heatingSystem: {
      thermalRegimePreset: 'traditional_dt50_75_65',
      hotWaterBoilerPowerMatchingScheme:
        'heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater',
    },
    hotWater: { residents: 2, fixtures: { shower: 1, sink: 1 } },
    ...overrides,
  });
}

/**
 * @param {() => void} fn
 * @param {string} label
 * @returns {boolean}
 */
function assertThrowsValidation(fn, label) {
  return assertThrowsValidationCode(fn, 'VALIDATION_ERROR', label);
}

/**
 * @param {() => void} fn
 * @param {string} expectedCode
 * @param {string} label
 */
function assertThrowsValidationCode(fn, expectedCode, label) {
  try {
    fn();
    console.log('FAIL', '—', label, '(ожидалась ошибка валидации)');
    return false;
  } catch (err) {
    const code = /** @type {{ code?: string }} */ (err).code;
    if (code !== expectedCode) {
      console.log('FAIL', '—', label, `(код ${code ?? 'unknown'}, ожидался ${expectedCode})`);
      return false;
    }
    console.log('OK', '—', label);
    return true;
  }
}

/**
 * @param {import('../src/types/shared-types.js').CalcRuntimeContext} ctx
 * @returns {boolean}
 */
function runValidationChecks(ctx) {
  console.log('=== Валидация thermalRegimePreset ===');

  let ok = true;

  ok = assertThrowsValidation(
    () =>
      validateAndNormalizeInput(
        minimalCalcBody({
          heatingSystem: { thermalRegimePreset: 'invalid_preset_xyz' },
        }),
        ctx,
      ),
    'неверный thermalRegimePreset отклоняется',
  ) && ok;

  for (const preset of HEATING_THERMAL_REGIME_PRESET_ENUM) {
    const body = validateAndNormalizeInput(
      minimalCalcBody({ heatingSystem: { thermalRegimePreset: preset } }),
      ctx,
    );
    const hs = body.heatingSystem;
    const presetOk =
      hs?.thermalRegimePreset === preset &&
      typeof hs?.supplyC === 'number' &&
      typeof hs?.returnC === 'number';
    console.log(presetOk ? 'OK' : 'FAIL', '— пресет', preset, '→', hs?.supplyC, '/', hs?.returnC);
    ok = presetOk && ok;
  }

  const baseVent = minimalCalcBody();
  ok =
    assertThrowsValidationCode(
      () =>
        validateAndNormalizeInput({
          ...baseVent,
          building: {
            ...baseVent.building,
            ventilation: { flowM3PerHour: 120 },
          },
        }, ctx),
      'VENTILATION_LEGACY_FIELD',
      'building.ventilation.flowM3PerHour отклоняется в MVP',
    ) && ok;

  const withNatural = validateAndNormalizeInput(minimalCalcBody(), ctx);
  const modeOk =
    withNatural.building?.objectMeta?.ventilationReserveMode === 'natural';
  console.log(modeOk ? 'OK' : 'FAIL', '— дефолт ventilationReserveMode natural');
  ok = modeOk && ok;

  const aptDefault = validateAndNormalizeInput(
    minimalCalcBody({
      building: {
        objectMeta: {
          objectType: 'apartment',
          floors: 1,
          roomsCount: 1,
          externalWalls: { presetId: 'wall_gas_concrete_d500' },
        },
        rooms: minimalCalcBody().building.rooms,
        envelopeElements: minimalCalcBody().building.envelopeElements,
        temps: { insideC: 20, outsideC: -5 },
      },
      heatingSystem: {},
    }),
    ctx,
  );
  const aptPreset = aptDefault.heatingSystem?.thermalRegimePreset;
  const aptOk = aptPreset === 'condensing_dt30_55_45';
  console.log(aptOk ? 'OK' : 'FAIL', '— квартира без пресета →', aptPreset);
  ok = aptOk && ok;

  const houseDefault = validateAndNormalizeInput(
    minimalCalcBody({
      building: {
        objectMeta: {
          objectType: 'house',
          floors: 1,
          roomsCount: 1,
          externalWalls: { presetId: 'wall_gas_concrete_d500' },
        },
        rooms: minimalCalcBody().building.rooms,
        envelopeElements: minimalCalcBody().building.envelopeElements,
        temps: { insideC: 20, outsideC: -5 },
      },
      heatingSystem: {},
    }),
    ctx,
  );
  const housePreset = houseDefault.heatingSystem?.thermalRegimePreset;
  const houseOk = housePreset === 'traditional_dt50_75_65';
  console.log(houseOk ? 'OK' : 'FAIL', '— дом без пресета →', housePreset);
  ok = houseOk && ok;

  return ok;
}

/**
 * @param {import('../src/types/shared-types.js').BoilerMatchingReport | undefined} boiler
 * @returns {boolean}
 */
function isCondensingBoilerSelected(boiler) {
  const selected = boiler?.selected;
  if (!selected) return false;
  return (
    String(selected.type ?? '').includes('condens') ||
    (selected.tags ?? []).some(
      /** @param {string} t */
      (t) => String(t).toLowerCase().includes('condens'),
    )
  );
}

/**
 * Текстовый warning alignHeatingGraphForCondensingBoiler (отдельного WARN_* code в справочнике нет).
 * @param {string[] | undefined} warnings
 * @returns {boolean}
 */
function hasCondensingHighGraphWarning(warnings) {
  return (warnings ?? []).some(
    (w) =>
      /конденсацион/i.test(w) &&
      (/высокотемператур/i.test(w) || /traditional_dt50_75_65/i.test(w)),
  );
}

/**
 * @param {import('../src/types/shared-types.js').CalcReport} report
 * @returns {boolean}
 */
function reportHasCondensingHighGraphMismatchWarning(report) {
  if (hasCondensingHighGraphWarning(report.matching?.boiler?.warnings)) return true;
  if (hasCondensingHighGraphWarning(report.warnings)) return true;
  return false;
}

/**
 * П.1 + П.3: traditional_dt50_75_65 в input → primary 3 сек; warning в report.
 *
 * @param {import('../src/types/shared-types.js').CalcRuntimeContext} ctx
 * @returns {Promise<boolean>}
 */
async function runTraditionalGraphAutoChecks(ctx) {
  console.log('\n=== [1][3] Auto/traditional: primary 75/65 + warning при condensing-котле ===');

  const input = validateAndNormalizeInput(minimalCalcBody(), ctx);
  const report = await buildReport({ input, ctx });

  let ok = true;

  ok = logCheck(
    report.input?.heatingSystem?.thermalRegimePreset === 'traditional_dt50_75_65'
      && report.input?.heatingSystem?.supplyC === 75
      && report.input?.heatingSystem?.returnC === 65,
    'report.input: график анкеты 75/65 не мутируется',
  ) && ok;

  ok = logCheck(
    isCondensingBoilerSelected(report.matching?.boiler),
    'подобран condensing-котёл',
    report.matching?.boiler?.selected?.model ?? '—',
  ) && ok;

  const secPrimary = report.matching?.radiators?.byRoom?.[0]?.sections;
  ok = logCheck(
    secPrimary === FIXTURE_SECTIONS_TRADITIONAL,
    `matchEquipment/buildReport (auto): ${FIXTURE_SECTIONS_TRADITIONAL} секции по 75/65`,
    `получено ${secPrimary ?? '—'}`,
  ) && ok;

  ok = logCheck(
    report.matching?.radiators?.inputs?.thermalRegimePreset === 'traditional_dt50_75_65'
      && report.matching?.radiators?.inputs?.supplyC === 75,
    'primary radiators.inputs = 75/65',
  ) && ok;

  ok = logCheck(
    reportHasCondensingHighGraphMismatchWarning(report),
    'report.warnings / boiler.warnings: condensing + высокий график (plain text, v3)',
  ) && ok;

  ok = logCheck(
    Boolean(report.matching?.radiators?.lineEfficient?.byRoom?.length),
    'lineEfficient присутствует как альтернатива 55/45',
  ) && ok;

  return ok;
}

/**
 * П.2: явный condensing_dt30_55_45 в input → primary 6 сек (изолированный кейс).
 *
 * @param {import('../src/types/shared-types.js').CalcRuntimeContext} ctx
 * @returns {Promise<boolean>}
 */
async function runExplicitCondensingInputChecks(ctx) {
  console.log('\n=== [2] Explicit input: condensing_dt30_55_45 → primary 55/45 ===');

  const input = validateAndNormalizeInput(
    minimalCalcBody({
      heatingSystem: {
        thermalRegimePreset: 'condensing_dt30_55_45',
        hotWaterBoilerPowerMatchingScheme:
          'heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater',
      },
    }),
    ctx,
  );

  let ok = true;

  ok = logCheck(
    input.heatingSystem?.thermalRegimePreset === 'condensing_dt30_55_45'
      && input.heatingSystem?.supplyC === 55
      && input.heatingSystem?.returnC === 45,
    'validate: пресет condensing_dt30_55_45 → 55/45',
  ) && ok;

  const report = await buildReport({ input, ctx });
  const secReport = report.matching?.radiators?.byRoom?.[0]?.sections;

  ok = logCheck(
    secReport === FIXTURE_SECTIONS_CONDENSING,
    `buildReport primary: ${FIXTURE_SECTIONS_CONDENSING} секций по 55/45`,
    `получено ${secReport ?? '—'}`,
  ) && ok;

  ok = logCheck(
    report.matching?.radiators?.inputs?.thermalRegimePreset === 'condensing_dt30_55_45'
      && report.matching?.radiators?.inputs?.supplyC === 55,
    'primary radiators.inputs = 55/45',
  ) && ok;

  ok = logCheck(
    !reportHasCondensingHighGraphMismatchWarning(report),
    'нет warning про высокий график при явном 55/45',
  ) && ok;

  // Изолированный matchEquipment на том же input
  const heatLoss = calculateHeatLossForBuilding({
    temps: { insideC: input.temps?.insideC ?? 20, outsideC: input.temps?.outsideC ?? -5 },
    building: input.building,
  });
  const hotWater = calculateHotWaterDemand(hotWaterInputFromCalcBody(input), ctx.waterNorms);
  const hsForMatch = structuredClone(input.heatingSystem ?? {});
  const { matching } = matchEquipmentTyped({
    heatLoss,
    hotWater,
    heatingSystem: hsForMatch,
    building: input.building,
    ctx,
  });
  const radiators = assertDefined(matching.radiators, 'matching.radiators');
  const secMatch = radiators.byRoom?.[0]?.sections;

  ok = logCheck(
    secMatch === FIXTURE_SECTIONS_CONDENSING,
    `matchEquipment (explicit 55/45 input): ${FIXTURE_SECTIONS_CONDENSING} секций`,
    `получено ${secMatch ?? '—'}`,
  ) && ok;

  return ok;
}

await warmupReferenceCache();
const ctx = toCalcRuntimeContext(await getReferenceBundle());
const { catalog, waterNorms } = ctx;

const validationOk = runValidationChecks(ctx);
const traditionalAutoOk = await runTraditionalGraphAutoChecks(ctx);
const explicitCondensingOk = await runExplicitCondensingInputChecks(ctx);

// Детальная сверка формул и lineEfficient vs explicit pick (traditional сценарий)
console.log('\n=== Формулы и lineEfficient (traditional input, v3) ===');

const highBody = validateAndNormalizeInput(minimalCalcBody(), ctx);
const heatLoss = calculateHeatLossForBuilding({
  temps: { insideC: highBody.temps?.insideC ?? 20, outsideC: highBody.temps?.outsideC ?? -5 },
  building: highBody.building,
});
const hotWater = calculateHotWaterDemand(hotWaterInputFromCalcBody(highBody), waterNorms);

const hsForMatch = structuredClone(highBody.heatingSystem ?? {});
const { matching } = matchEquipmentTyped({
  heatLoss,
  hotWater,
  heatingSystem: hsForMatch,
  building: highBody.building,
  ctx,
});

const radiatorsHigh = pickRadiators({
  roomsHeatLoss: heatLoss,
  heatingSystem: structuredClone(highBody.heatingSystem),
  catalog,
  building: highBody.building,
  boilerMatching: matching.boiler,
});

const hsLow = structuredClone(highBody.heatingSystem);
if (hsLow) {
  hsLow.thermalRegimePreset = 'condensing_dt30_55_45';
  hsLow.supplyC = 55;
  hsLow.returnC = 45;
  hsLow.radiatorReferenceDeltaT = 50;
}
const radiatorsLowExplicit = pickRadiators({
  roomsHeatLoss: heatLoss,
  heatingSystem: hsLow ?? {},
  catalog,
  building: highBody.building,
  boilerMatching: null,
  radiatorLineTier: 'efficient',
});

const roomQ = assertAt(assertDefined(heatLoss.rooms, 'heatLoss.rooms'), 0, 'heatLoss.rooms[0]').envelopeWatts;
const radiatorsMatch = assertDefined(matching.radiators, 'matching.radiators');
const baseWatts = radiatorsMatch.chosen?.baseOutputWatts ?? 0;
const passportBaseDeltaT = /** @type {50 | 70} */ (radiatorsMatch.chosen?.baseDeltaT ?? 50);
const ventMode = highBody.building?.objectMeta?.ventilationReserveMode ?? 'natural';

const expHigh = expectedSections(roomQ, ventMode, baseWatts, passportBaseDeltaT, 75, 65);
const expLow = expectedSections(roomQ, ventMode, baseWatts, passportBaseDeltaT, 55, 45);

const secMatch = radiatorsMatch.byRoom[0]?.sections;
const secHigh = radiatorsHigh.byRoom[0]?.sections;
const secLowExplicit = radiatorsLowExplicit.byRoom[0]?.sections;
const secLineEfficient = radiatorsMatch.lineEfficient?.byRoom?.[0]?.sections;

console.log(
  'auto primary:', secMatch,
  '| manual 75/65:', secHigh,
  '| explicit 55/45 pick:', secLowExplicit,
  '| lineEfficient:', secLineEfficient,
);
console.log(
  'formula 75/65:', expHigh.sections,
  '| formula 55/45:', expLow.sections,
);

let formulaOk = true;
formulaOk = logCheck(
  secMatch === FIXTURE_SECTIONS_TRADITIONAL && secMatch === expHigh.sections,
  'auto primary = 3 сек = формула 75/65',
) && formulaOk;
formulaOk = logCheck(
  secLowExplicit === FIXTURE_SECTIONS_CONDENSING && secLowExplicit === expLow.sections,
  'explicit pick = 6 сек = формула 55/45',
) && formulaOk;
formulaOk = logCheck(
  secLineEfficient === secLowExplicit,
  'lineEfficient === explicit pick 55/45',
) && formulaOk;
formulaOk = logCheck(
  secMatch === secHigh,
  'auto primary === manual pickRadiators 75/65',
) && formulaOk;

const baseForRecup = minimalCalcBody();
const recuperBody = validateAndNormalizeInput({
  ...baseForRecup,
  building: {
    ...baseForRecup.building,
    objectMeta: {
      ...baseForRecup.building.objectMeta,
      ventilationReserveMode: 'recuperation',
    },
  },
}, ctx);
const heatRecup = calculateHeatLossForBuilding({
  temps: { insideC: 20, outsideC: -5 },
  building: recuperBody.building,
});
const kVentRecupOk = assertAt(assertDefined(heatRecup.rooms, 'heatRecup.rooms'), 0, 'heatRecup.rooms[0]').ventilationReserveFactor === 1.1;
formulaOk = logCheck(kVentRecupOk, 'recuperation kVent 1.1') && formulaOk;

const allOk =
  validationOk &&
  traditionalAutoOk &&
  explicitCondensingOk &&
  formulaOk;

console.log('\n=== Итог ===', allOk ? 'ALL OK' : 'FAILED');
process.exit(allOk ? 0 : 1);
