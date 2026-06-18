/**
 * Назначение: подсказка о последовательном электробуфере для квартиры с двухконтурным котлом.
 * Описание: Пороги из appliances.boiler.hints.apartmentCombiSerialBuffer; текст рекомендации — из коллекции recommendations.
 */

import { resolveRecommendation } from '../recommendations/recommendationResolver.js';
import {
  SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_MAX_COMBI,
} from '../../../shared/heatingMatchingSchemes.js';

/**
 * @param {import('../dhw/types').BoilerApplianceRules['hints']['apartmentCombiSerialBuffer'] | undefined} [serialBufferConfig]
 * @returns {import('../dhw/types').BoilerApplianceRules['hints']['apartmentCombiSerialBuffer']}
 */
function resolveSerialBufferConfig(serialBufferConfig) {
  if (serialBufferConfig) return serialBufferConfig;
  throw new Error(
    'apartmentCombiSerialBufferHint: serialBufferConfig обязателен (передайте appliances.byKind.boiler.hints.apartmentCombiSerialBuffer из CalcRuntimeContext).',
  );
}

/**
 * @param {import('../types/shared-types').HotWaterFixturesInput | undefined} fixtures
 */
function thermalFixtureCount(fixtures) {
  if (!fixtures || typeof fixtures !== 'object') return 0;
  return (
    (Number(fixtures.shower) || 0) +
    (Number(fixtures.bath) || 0) +
    (Number(fixtures.sink) || 0) +
    (Number(fixtures.kitchenSink) || 0)
  );
}

/**
 * @param {object} p
 * @param {'apartment' | 'house'} p.objectType
 * @param {import('../types/boiler-types').HotWaterBoilerPowerMatchingScheme} p.requestedScheme
 * @param {import('../types/boiler-types').BoilerCircuitFallbackReport | null | undefined} [p.circuitFallback]
 * @param {'flowThrough' | 'storage' | undefined} p.dhwSupplyScenario
 * @param {import('../types/shared-types').HotWaterFixturesInput | undefined} [p.fixtures]
 * @param {number} [p.peakThermalPowerKw]
 * @param {import('../dhw/types').BoilerApplianceRules['hints']['apartmentCombiSerialBuffer']} [p.serialBufferConfig]
 */
export function isApartmentCombiSerialBufferEligible({
  objectType,
  requestedScheme,
  circuitFallback,
  dhwSupplyScenario,
  fixtures,
  peakThermalPowerKw,
  serialBufferConfig,
}) {
  const cfg = resolveSerialBufferConfig(serialBufferConfig);
  if (!cfg?.enabled) return false;
  if (objectType !== 'apartment') return false;
  if (requestedScheme !== SCHEME_BOILER_MAX_COMBI) return false;
  if (circuitFallback) return false;
  if (dhwSupplyScenario !== 'flowThrough') return false;

  const peak = Number(peakThermalPowerKw) || 0;
  const tf = thermalFixtureCount(fixtures);
  return (
    tf >= cfg.minThermalFixtures || peak >= cfg.peakThermalPowerKwMin
  );
}

/** @param {import('../dhw/types').BoilerApplianceRules['hints']['apartmentCombiSerialBuffer']} [serialBufferConfig] */
export function apartmentCombiSerialBufferTemplateVars(serialBufferConfig) {
  const cfg = resolveSerialBufferConfig(serialBufferConfig);
  return {
    bufferMinLiters: cfg.bufferTankLitersMin,
    bufferMaxLiters: cfg.bufferTankLitersMax,
  };
}

/**
 * @returns {import('../types/boiler-types').BoilerMatchingRecommendation | null}
 * @param {import('../dhw/types').BoilerApplianceRules['hints']['apartmentCombiSerialBuffer']} serialBufferConfig
 * @param {import('../recommendations/types').RecommendationsBundle} recommendations
 */
export function buildApartmentCombiSerialBufferRecommendation(
  serialBufferConfig,
  recommendations,
) {
  const resolved = resolveRecommendation(
    recommendations,
    'REC_APT_COMBI_SERIAL_BUFFER',
    apartmentCombiSerialBufferTemplateVars(serialBufferConfig),
  );
  if (!resolved) return null;
  return {
    type: 'apartment_combi_serial_electric_buffer_hint',
    message: resolved.text,
  };
}

/**
 * Добавить подсказку в meta.automationHints (после matching, когда известен circuitFallback).
 *
 * @param {import('../types/shared-types').MatchingAutomationHint[]} hints
 * @param {object} p
 * @param {'apartment' | 'house'} p.objectType
 * @param {import('../types/boiler-types').HotWaterBoilerPowerMatchingScheme} p.requestedScheme
 * @param {import('../types/boiler-types').BoilerCircuitFallbackReport | null | undefined} [p.circuitFallback]
 * @param {import('../types/shared-types').HotWaterReport | undefined} p.hotWaterReport
 * @param {import('../dhw/types').BoilerApplianceRules['hints']['apartmentCombiSerialBuffer']} [p.serialBufferConfig]
 * @param {import('../recommendations/types').RecommendationsBundle} p.recommendations
 */
export function appendApartmentCombiSerialBufferAutomationHint(hints, {
  objectType,
  requestedScheme,
  circuitFallback,
  hotWaterReport,
  serialBufferConfig,
  recommendations,
}) {
  if (
    !isApartmentCombiSerialBufferEligible({
      objectType,
      requestedScheme,
      circuitFallback,
      dhwSupplyScenario: hotWaterReport?.dhwSupplyScenario,
      fixtures: hotWaterReport?.fixtures,
      peakThermalPowerKw: hotWaterReport?.peakThermalPowerKw,
      serialBufferConfig,
    })
  ) {
    return;
  }

  const rec = buildApartmentCombiSerialBufferRecommendation(
    serialBufferConfig,
    recommendations,
  );
  if (!rec) return;

  hints.push({
    type: 'apartment_combi_serial_electric_buffer',
    message: rec.message,
    suggestedScheme: SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
  });
}

/**
 * Подсказка: при oversize 1К предложить переход на max-combi (без принудительной подмены схемы).
 *
 * @param {import('../types/shared-types').MatchingAutomationHint[]} hints
 * @param {object} p
 * @param {'apartment' | 'house'} p.objectType
 * @param {import('../types/boiler-types').HotWaterBoilerPowerMatchingScheme} p.requestedScheme
 * @param {import('../types/boiler-types').BoilerCircuitFallbackReport | null | undefined} [p.circuitFallback]
 * @param {import('../recommendations/types').ResolvedRecommendation[]} [p.resolvedRecommendations]
 * @param {import('../recommendations/types').RecommendationsBundle} p.recommendations
 */
export function appendApartmentSingleOversizeCombiHint(hints, {
  objectType,
  requestedScheme,
  circuitFallback,
  resolvedRecommendations,
  recommendations,
}) {
  if (objectType !== 'apartment') return;
  if (requestedScheme !== SCHEME_BOILER_ELECTRIC_SEPARATE) return;
  if (circuitFallback) return;
  const hasRec = (resolvedRecommendations ?? []).some(
    (r) => r.code === 'REC_APT_SINGLE_TO_COMBI_OPTIMIZATION',
  );
  if (!hasRec) return;

  const rec = resolveRecommendation(recommendations, 'REC_APT_SINGLE_TO_COMBI_OPTIMIZATION');
  hints.push({
    type: 'apartment_single_oversized_suggest_combi',
    message:
      rec?.text ??
      'Рассмотрите двухконтурный котёл вместо избыточного одноконтурного — ГВС через встроенный контур котла.',
    suggestedScheme: SCHEME_BOILER_MAX_COMBI,
  });
}
