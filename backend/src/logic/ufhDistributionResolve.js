/**
 * Назначение: выбор схемы распределения ТП с порогами из appliances.
 * Описание: Обёртка над shared/ufhDistributionPresets.js для buildReport и warmFloorCalc.
 */

import { resolveUfhDistributionPreset } from '../../../shared/ufhDistributionPresets.js';

/**
 * @param {import('../dhw/types').UnderfloorHeatingApplianceRules | undefined} ufhAppliance
 * @returns {import('../../../shared/ufhDistributionPresets.js').UfhDistributionAutoRules | undefined}
 */
export function ufhDistributionAutoRulesFromAppliances(ufhAppliance) {
  return ufhAppliance?.distribution;
}

/**
 * @param {import('../../../shared/ufhDistributionPresets.js').UfhDistributionPreset | undefined | null} requested
 * @param {object} ctx
 * @param {import('../dhw/types').AppliancesBundle | undefined} [appliances]
 * @returns {Exclude<import('../../../shared/ufhDistributionPresets.js').UfhDistributionPreset, 'auto'>}
 */
export function resolveUfhDistributionWithAppliances(requested, ctx, appliances) {
  const autoRules = ufhDistributionAutoRulesFromAppliances(
    appliances?.byKind?.underfloor_heating,
  );
  return resolveUfhDistributionPreset(requested, { ...ctx, autoRules });
}
