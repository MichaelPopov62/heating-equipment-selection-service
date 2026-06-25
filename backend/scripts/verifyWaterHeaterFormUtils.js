/**
 * Назначение: Smoke-тест shared-контракта формы водонагревателя.
 * Описание: Запуск: node backend/scripts/verifyWaterHeaterFormUtils.js
 */

import {
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from '../../shared/heatingMatchingSchemes.js';
import {
  objectMetaForCalcPayload,
  shouldShowIndirectDhwSpaceCheckbox,
} from '../../shared/waterHeaterFormContract.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

const houseMeta = { objectType: 'house', floors: 1, roomsCount: 1 };
const aptMeta = { objectType: 'apartment', floors: 1, roomsCount: 2 };

assert(
  objectMetaForCalcPayload(houseMeta, {
    hotWaterBoilerPowerMatchingScheme: SCHEME_BOILER_MAX_COMBI,
    indirectDhwSpaceAvailable: true,
  }).indirectDhwSpaceAvailable === undefined,
  'дом: флаг БКН не попадает в payload даже если true в форме',
);

assert(
  objectMetaForCalcPayload(aptMeta, {
    hotWaterBoilerPowerMatchingScheme: SCHEME_BOILER_SINGLE_INDIRECT_SUM,
    indirectDhwSpaceAvailable: true,
  }).indirectDhwSpaceAvailable === true,
  'квартира 1К+БКН + галочка → indirectDhwSpaceAvailable в payload',
);

assert(
  objectMetaForCalcPayload(aptMeta, {
    hotWaterBoilerPowerMatchingScheme: SCHEME_BOILER_SINGLE_INDIRECT_SUM,
    indirectDhwSpaceAvailable: false,
  }).indirectDhwSpaceAvailable === undefined,
  'квартира 1К+БКН без галочки → флаг не отправляется',
);

assert(
  !shouldShowIndirectDhwSpaceCheckbox('house', SCHEME_BOILER_SINGLE_INDIRECT_SUM),
  'дом: галочка БКН не показывается',
);

assert(
  shouldShowIndirectDhwSpaceCheckbox('apartment', SCHEME_BOILER_SINGLE_INDIRECT_SUM),
  'квартира + 1К+БКН: галочка показывается',
);

assert(
  !shouldShowIndirectDhwSpaceCheckbox('apartment', SCHEME_BOILER_MAX_COMBI),
  'квартира + max-combi: галочка скрыта',
);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nverifyWaterHeaterFormUtils: all passed');
