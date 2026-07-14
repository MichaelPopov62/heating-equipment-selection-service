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
import { buildObjectMeta } from './fixtures/verifyFixtures.js';

let failed = 0;

/**
 * @param {boolean} cond
 * @param {string} msg
 */
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

const houseMeta = buildObjectMeta({ objectType: 'house', roomsCount: 1 });
const aptMeta = buildObjectMeta({ objectType: 'apartment', roomsCount: 2 });

assert(
  objectMetaForCalcPayload(
    /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (houseMeta)),
    {
      hotWaterBoilerPowerMatchingScheme: SCHEME_BOILER_MAX_COMBI,
      indirectDhwSpaceAvailable: true,
    },
  ).indirectDhwSpaceAvailable === undefined,
  'дом: флаг БКН не попадает в payload даже если true в форме',
);

assert(
  objectMetaForCalcPayload(
    /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (aptMeta)),
    {
      hotWaterBoilerPowerMatchingScheme: SCHEME_BOILER_SINGLE_INDIRECT_SUM,
      indirectDhwSpaceAvailable: true,
    },
  ).indirectDhwSpaceAvailable === true,
  'квартира 1К+БКН + галочка → indirectDhwSpaceAvailable в payload',
);

assert(
  objectMetaForCalcPayload(
    /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (aptMeta)),
    {
      hotWaterBoilerPowerMatchingScheme: SCHEME_BOILER_SINGLE_INDIRECT_SUM,
      indirectDhwSpaceAvailable: false,
    },
  ).indirectDhwSpaceAvailable === undefined,
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
