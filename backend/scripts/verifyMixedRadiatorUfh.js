/**
 * Назначение: проверка вычета отдачи ТП при подборе радиаторов в режиме mixed.
 * Запуск: node scripts/verifyMixedRadiatorUfh.js (из backend/)
 */

import { warmupReferenceCache, getReferenceBundle } from '../src/reference/configCache.js';
import { validateAndNormalizeInput } from '../src/api/validate.js';
import { buildReport } from '../src/report/buildReport.js';
import {
  buildUfhHeatFluxUpWattsByRoomId,
  resolveMixedRadiatorRoomLoad,
} from '../src/matching/internal/resolveMixedRadiatorRoomLoad.js';

await warmupReferenceCache();
const bundle = await getReferenceBundle();

const body = {
  building: {
    temps: { insideC: 20, outsideC: -5 },
    objectMeta: {
      objectType: 'apartment',
      floors: 1,
      roomsCount: 2,
      ventilationReserveMode: 'natural',
      externalWalls: {
        presetId: 'wall_gas_concrete_d500',
        thicknessMm: 450,
        facadeSystem: 'sftk',
        insulationPresetId: 'insul_sftk_pps16f',
        insulationThicknessMm: 100,
      },
    },
    rooms: [
      {
        id: 'r1',
        name: 'Комната 1',
        type: 'living',
        floor: 1,
        topBoundary: 'heated',
        areaM2: 20,
        heightM: 2.7,
        roomExteriorLayout: 'facade',
      },
      {
        id: 'r2',
        name: 'Комната 2',
        type: 'kitchen',
        floor: 1,
        topBoundary: 'heated',
        areaM2: 12,
        heightM: 2.7,
        roomExteriorLayout: 'facade',
        underfloorHeating: {
          enabled: true,
          basePresetId: 'ufh_base_interstory_screed_65',
          finishMaterialId: 'ceramic_tile',
          pipeSpacingMm: 150,
        },
      },
    ],
    envelopeElements: [
      {
        kind: 'wall',
        roomId: 'r1',
        name: 'Стена',
        construction: 'наружная стена',
        presetId: 'wall_gas_concrete_d500',
        areaM2: 10.8,
        orientation: 'N',
      },
      {
        kind: 'window',
        roomId: 'r1',
        construction: 'окно',
        presetId: 'window_pvc_double_chamber_3_glass',
        areaM2: 2.5,
        orientation: 'N',
        openingWidthMm: 1500,
        openingHeightMm: 1400,
        name: 'Окно r1',
      },
      {
        kind: 'wall',
        roomId: 'r2',
        name: 'Стена',
        construction: 'наружная стена',
        presetId: 'wall_gas_concrete_d500',
        areaM2: 6.5,
        orientation: 'E',
      },
      {
        kind: 'window',
        roomId: 'r2',
        construction: 'окно',
        presetId: 'window_pvc_double_chamber_3_glass',
        areaM2: 2.0,
        orientation: 'E',
        openingWidthMm: 1200,
        openingHeightMm: 1200,
        name: 'Окно r2',
      },
    ],
  },
  heatingSystem: {
    hotWaterBoilerPowerMatchingScheme: 'combiBoilerWithBufferElectricStorage',
    thermalRegimePreset: 'condensing_dt30_55_45',
    waterUnderfloorHeating: true,
    ufhPresetId: 'ufh_mixed_radiators',
    underfloorDistributionPreset: 'auto',
  },
  hotWater: {
    residents: 2,
    coldWaterDesignSeason: 'winter',
    hotWaterC: 60,
    fixtures: { shower: 1, sink: 1, toilet: 1, kitchenSink: 1 },
  },
};

const input = validateAndNormalizeInput(body);
const report = await buildReport({
  input,
  catalog: bundle.catalog,
  waterNorms: bundle.waterNorms,
  appliances: bundle.appliances,
  catalogSource: 'file',
  waterNormsSource: 'file',
  appliancesSource: 'file',
  recommendationsSource: 'file',
});

const r2hl = report.calculations.heatLoss.rooms.find((r) => r.id === 'r2');
const r2ufh = report.calculations.underfloorHeating?.rooms?.find((r) => r.roomId === 'r2');
const r2rad = report.matching.radiators?.byRoom?.find((r) => r.roomId === 'r2');

const ufhMap = buildUfhHeatFluxUpWattsByRoomId(report.calculations.underfloorHeating);
const expectedLoad = resolveMixedRadiatorRoomLoad({
  designWattsFull: r2hl?.designWatts ?? 0,
  ufhHeatFluxUpWatts: ufhMap.get('r2'),
});

const skipOk = expectedLoad.skipRadiator === true;
const designWattsOk = r2rad?.radiatorDesignWatts === 0;
const modelOk = r2rad?.radiatorModel === '—';
const sectionsOk = r2rad?.sections == null;
const noteOk = (r2rad?.sizingNotes ?? []).some((n) => n.includes('радиатор не требуется'));
const ufhCoversOk =
  typeof r2ufh?.heatFluxUpWatts === 'number'
  && typeof r2hl?.designWatts === 'number'
  && r2ufh.heatFluxUpWatts >= r2hl.designWatts;

console.log('=== verifyMixedRadiatorUfh ===');
console.log('r2 designWatts:', Math.round(r2hl?.designWatts ?? 0));
console.log('r2 UFH heatFluxUpWatts:', r2ufh?.heatFluxUpWatts);
console.log('r2 radiatorDesignWatts:', r2rad?.radiatorDesignWatts);
console.log('r2 radiatorModel:', r2rad?.radiatorModel);
console.log('r2 sections:', r2rad?.sections);
console.log('');
console.log(ufhCoversOk ? 'OK' : 'FAIL', '— ТП покрывает designWatts комнаты 2');
console.log(skipOk ? 'OK' : 'FAIL', '— resolveMixedRadiatorRoomLoad.skipRadiator');
console.log(designWattsOk ? 'OK' : 'FAIL', '— radiatorDesignWatts = 0');
console.log(modelOk ? 'OK' : 'FAIL', '— radiatorModel = —');
console.log(sectionsOk ? 'OK' : 'FAIL', '— sections = null');
console.log(noteOk ? 'OK' : 'FAIL', '— sizingNote про отсутствие радиатора');

const allOk = ufhCoversOk && skipOk && designWattsOk && modelOk && sectionsOk && noteOk;
console.log('\n=== Итог ===', allOk ? 'ALL OK' : 'FAILED');
process.exit(allOk ? 0 : 1);
