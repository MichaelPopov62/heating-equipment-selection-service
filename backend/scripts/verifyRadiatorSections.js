/**
 * Назначение: dev-скрипт проверки расчёта секций радиаторов.
 * Описание: Прогоняет подбор после автопереключения графика 75/65 → 55/45; запуск из backend/: node scripts/verifyRadiatorSections.js.
 */

import { warmupReferenceCache, getReferenceBundle } from '../src/reference/configCache.js';
import { validateAndNormalizeInput } from '../src/api/validate.js';
import { matchEquipment } from '../src/matching/index.js';
import { pickRadiators } from './utils/radiatorHelpers.js';
import { calculateHeatLossForBuilding } from '../src/logic/heatlossByRooms.js';
import { calculateHotWaterDemand } from '../src/logic/hotWater.js';
import { resolveKVent } from '../src/logic/ventilationReserve.js';
import { buildReport } from '../src/report/buildReport.js';
import { HEATING_THERMAL_REGIME_PRESET_ENUM } from '../src/logic/heatingThermalRegimes.js';
import { adjustOutputWatts } from '../src/matching/radiatorSizingHelpers.js';

function deltaTmeanK({ supplyC, returnC, insideC }) {
  return (supplyC + returnC) / 2 - insideC;
}

/**
 * @param {number} qEnvelope
 * @param {import('../src/logic/ventilationReserve.js').VentilationReserveMode | undefined} ventilationMode
 * @param {number} baseWatts
 * @param {50 | 70} baseDeltaT
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
          type: 'living',
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

/** @returns {boolean} */
function runValidationChecks() {
  console.log('=== Валидация thermalRegimePreset ===');

  let ok = true;

  ok = assertThrowsValidation(
    () =>
      validateAndNormalizeInput(
        minimalCalcBody({
          heatingSystem: { thermalRegimePreset: 'invalid_preset_xyz' },
        }),
      ),
    'неверный thermalRegimePreset отклоняется',
  ) && ok;

  for (const preset of HEATING_THERMAL_REGIME_PRESET_ENUM) {
    const body = validateAndNormalizeInput(
      minimalCalcBody({ heatingSystem: { thermalRegimePreset: preset } }),
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
        }),
      'VENTILATION_LEGACY_FIELD',
      'building.ventilation.flowM3PerHour отклоняется в MVP',
    ) && ok;

  const withNatural = validateAndNormalizeInput(minimalCalcBody());
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
  );
  const housePreset = houseDefault.heatingSystem?.thermalRegimePreset;
  const houseOk = housePreset === 'traditional_dt50_75_65';
  console.log(houseOk ? 'OK' : 'FAIL', '— дом без пресета →', housePreset);
  ok = houseOk && ok;

  return ok;
}

/** @returns {Promise<boolean>} */
async function runReportInputChecks(bundle) {
  console.log('\n=== buildReport: echo input после автографика ===');

  const input = validateAndNormalizeInput(minimalCalcBody());
  const report = await buildReport({
    input,
    catalog: bundle.catalog,
    waterNorms: bundle.waterNorms,
    appliances: bundle.appliances,
    ufhPresetsSource: bundle.ufhPresetsSource,
    ufhPresetsSchemaVersion: bundle.ufhPresets.schemaVersion,
  });

  const metaUfhOk =
    typeof report.meta?.ufhPresetsSchemaVersion === 'number'
    && report.meta.ufhPresetsSchemaVersion >= 1;
  console.log(
    metaUfhOk ? 'OK' : 'FAIL',
    '— meta.ufhPresetsSchemaVersion:',
    report.meta?.ufhPresetsSchemaVersion,
  );

  const hs = report.input?.heatingSystem;
  const hsRecord = /** @type {Record<string, unknown> | undefined} */ (hs);
  const noInternalFlag = hsRecord?._thermalRegimeAutoAdjusted === undefined;
  const graphOk =
    hs?.thermalRegimePreset === 'condensing_dt30_55_45' &&
    hs?.supplyC === 55 &&
    hs?.returnC === 45;
  const condensingSelected =
    String(report.matching?.boiler?.selected?.type ?? '').includes('condens') ||
    (report.matching?.boiler?.selected?.tags ?? []).some((t) =>
      String(t).toLowerCase().includes('condens'),
    );

  console.log(
    noInternalFlag ? 'OK' : 'FAIL',
    '— _thermalRegimeAutoAdjusted не в report.input',
  );
  console.log(
    graphOk ? 'OK' : 'FAIL',
    '— report.input график 55/45:',
    hs?.thermalRegimePreset,
    hs?.supplyC,
    hs?.returnC,
  );
  console.log(
    condensingSelected ? 'OK' : 'WARN',
    '— selected condensing:',
    report.matching?.boiler?.selected?.model,
  );

  return noInternalFlag && graphOk && condensingSelected && metaUfhOk;
}

const baseBody = minimalCalcBody();

await warmupReferenceCache();
const bundle = await getReferenceBundle();
const { catalog, waterNorms } = bundle;

const validationOk = runValidationChecks();
const reportInputOk = await runReportInputChecks(bundle);

const highBody = validateAndNormalizeInput(structuredClone(baseBody));
const heatLoss = calculateHeatLossForBuilding({
  temps: { insideC: highBody.temps?.insideC ?? 20, outsideC: highBody.temps?.outsideC ?? -5 },
  building: highBody.building,
});
const hotWater = calculateHotWaterDemand(highBody, waterNorms);

// Полный пайплайн matching (с автопереключением графика)
const hsForMatch = structuredClone(highBody.heatingSystem);
const { matching } = matchEquipment({
  heatLoss,
  hotWater,
  heatingSystem: hsForMatch,
  catalog,
  building: highBody.building,
});

// Ручной расчёт без автопереключения (75/65)
const hsHigh = structuredClone(highBody.heatingSystem);
const radiatorsHigh = pickRadiators({
  roomsHeatLoss: heatLoss,
  heatingSystem: hsHigh,
  catalog,
  building: highBody.building,
  boilerMatching: matching.boiler,
});

// Явный 55/45 (как после автопереключения)
const hsLow = structuredClone(highBody.heatingSystem);
hsLow.thermalRegimePreset = 'condensing_dt30_55_45';
hsLow.supplyC = 55;
hsLow.returnC = 45;
hsLow.radiatorReferenceDeltaT = 50;
const radiatorsLowExplicit = pickRadiators({
  roomsHeatLoss: heatLoss,
  heatingSystem: hsLow,
  catalog,
  building: highBody.building,
  boilerMatching: matching.boiler,
});

const roomQ = heatLoss.rooms[0].envelopeWatts;
const chosen = matching.radiators.chosen;
const baseWatts = chosen?.baseOutputWatts ?? 0;
const passportBaseDeltaT = /** @type {50 | 70} */ (chosen?.baseDeltaT ?? 50);

const ventMode = highBody.building?.objectMeta?.ventilationReserveMode ?? 'natural';
const expHigh = expectedSections(
  roomQ,
  ventMode,
  baseWatts,
  passportBaseDeltaT,
  75,
  65,
);
const expLow = expectedSections(
  roomQ,
  ventMode,
  baseWatts,
  passportBaseDeltaT,
  55,
  45,
);

const secHigh = radiatorsHigh.byRoom[0]?.sections;
const secMatch = matching.radiators.byRoom[0]?.sections;
const secLowExplicit = radiatorsLowExplicit.byRoom[0]?.sections;

const outHigh = radiatorsHigh.byRoom[0]?.outputPerSectionWatts;
const outMatch = matching.radiators.byRoom[0]?.outputPerSectionWatts;
const outLow = radiatorsLowExplicit.byRoom[0]?.outputPerSectionWatts;

console.log('=== Котёл ===');
console.log('selected:', matching.boiler.selected?.model, matching.boiler.selected?.type);
console.log('proposalEfficient:', matching.boiler.proposalEfficient?.selected?.model ?? null);

console.log('\n=== График в matching ===');
console.log(
  'heatingSystem after match:',
  hsForMatch.thermalRegimePreset,
  hsForMatch.supplyC,
  hsForMatch.returnC,
);
console.log('report radiators inputs:', matching.radiators.inputs);

console.log('\n=== Секции по комнате r1 ===');
console.log('Q envelope W:', roomQ);
console.log('radiator:', chosen?.model, 'passport ΔT50 W:', baseWatts);
console.log('');
console.log('75/65 manual pickRadiators:', secHigh, 'W/сек:', outHigh);
console.log('55/45 explicit pickRadiators:', secLowExplicit, 'W/сек:', outLow);
console.log('matchEquipment (auto):', secMatch, 'W/сек:', outMatch);
console.log('');
console.log('formula 75/65 expected:', expHigh.sections, 'W/сек:', Math.round(expHigh.adjustedWatts));
console.log('formula 55/45 expected:', expLow.sections, 'W/сек:', Math.round(expLow.adjustedWatts));

const ratio = secHigh && secMatch ? (secMatch / secHigh).toFixed(2) : '—';
console.log('\nОтношение секций (auto / high):', ratio);

const okMatchLow = secMatch === secLowExplicit && outMatch === outLow;
const okFormulaHigh =
  secHigh === expHigh.sections &&
  outHigh === Math.max(1, Math.round(expHigh.adjustedWatts));
const okFormulaLow =
  secMatch === expLow.sections &&
  outMatch === Math.max(1, Math.round(expLow.adjustedWatts));
const noHighGraphWarning = !(matching.radiators.warnings ?? []).some((w) =>
  w.includes('55/45'),
);

console.log('\n=== Проверки секций ===');
console.log(okFormulaHigh ? 'OK' : 'FAIL', '— формула 75/65');
console.log(okFormulaLow ? 'OK' : 'FAIL', '— формула 55/45 после auto');
console.log(okMatchLow ? 'OK' : 'FAIL', '— auto === явный 55/45');
console.log(noHighGraphWarning ? 'OK' : 'FAIL', '— нет warning про высокий график при condensing');
console.log(
  hsForMatch.thermalRegimePreset === 'condensing_dt30_55_45' ? 'OK' : 'FAIL',
  '— график переключён на condensing_dt30_55_45',
);

const expectedTotal = roomQ * expHigh.kVent;
const totalWattsOk = Math.abs(heatLoss.totalWatts - expectedTotal) < 0.5;
const designRoomOk =
  Math.abs((heatLoss.rooms[0]?.designWatts ?? 0) - expectedTotal) < 0.5;

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
});
const heatRecup = calculateHeatLossForBuilding({
  temps: { insideC: 20, outsideC: -5 },
  building: recuperBody.building,
});
const kVentRecupOk = heatRecup.rooms[0]?.ventilationReserveFactor === 1.1;

console.log(totalWattsOk ? 'OK' : 'FAIL', '— totalWatts = envelope × kVent');
console.log(designRoomOk ? 'OK' : 'FAIL', '— designWatts по комнате');
console.log(kVentRecupOk ? 'OK' : 'FAIL', '— recuperation kVent 1.1');

const sectionsOk =
  okFormulaHigh &&
  okFormulaLow &&
  okMatchLow &&
  noHighGraphWarning &&
  hsForMatch.thermalRegimePreset === 'condensing_dt30_55_45' &&
  totalWattsOk &&
  designRoomOk &&
  kVentRecupOk;

const allOk = validationOk && reportInputOk && sectionsOk;
console.log('\n=== Итог ===', allOk ? 'ALL OK' : 'FAILED');
process.exit(allOk ? 0 : 1);
