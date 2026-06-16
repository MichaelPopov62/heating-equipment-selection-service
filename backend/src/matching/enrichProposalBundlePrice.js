/**
 * Назначение: обогащение карточек вариантов котла.
 * Описание: расчёт суммарной цены и состава комплекта (котёл + электробойлер и/или БКН) по схеме
 * ГВС и линии подбора — основная, эконом или эффективный.
 */
import {
  SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from '../../../shared/heatingMatchingSchemes.js';

/**
 * @param {import('../types/shared-types').WaterHeaterMatchingReport | undefined} waterHeater
 * @returns {import('../types/boiler-types').EquipmentBundleCompanion | null}
 */
function buildWaterHeaterCompanion(waterHeater) {
  const selected = waterHeater?.selected;
  if (!selected?.model) return null;
  const variant = waterHeater?.chosenVariant;
  const price =
    typeof variant?.price === 'number' && Number.isFinite(variant.price)
      ? variant.price
      : undefined;
  const volumeLiters =
    typeof variant?.volumeLiters === 'number' &&
    Number.isFinite(variant.volumeLiters)
      ? variant.volumeLiters
      : undefined;
  return {
    role: 'water_heater',
    model: selected.model,
    ...(typeof selected.brand === 'string' && selected.brand.trim()
      ? { brand: selected.brand.trim() }
      : {}),
    ...(volumeLiters != null ? { volumeLiters } : {}),
    ...(price != null ? { price } : {}),
  };
}

/**
 * @param {import('../types/shared-types').IndirectWaterHeaterMatchingReport | undefined} indirectWaterHeater
 * @returns {import('../types/boiler-types').EquipmentBundleCompanion | null}
 */
function buildIndirectWaterHeaterCompanion(indirectWaterHeater) {
  const selected = indirectWaterHeater?.selected;
  if (!selected?.model) return null;
  const price =
    typeof selected.price === 'number' && Number.isFinite(selected.price)
      ? selected.price
      : undefined;
  const volumeLiters =
    typeof selected.specs?.volumeLiters === 'number' &&
    Number.isFinite(selected.specs.volumeLiters)
      ? selected.specs.volumeLiters
      : undefined;
  return {
    role: 'indirect_water_heater',
    model: selected.model,
    ...(typeof selected.brand === 'string' && selected.brand.trim()
      ? { brand: selected.brand.trim() }
      : {}),
    ...(volumeLiters != null ? { volumeLiters } : {}),
    ...(price != null ? { price } : {}),
  };
}

/**
 * Какие companions показывать в карточке варианта.
 *
 * @param {object} ctx
 * @param {'proposal' | 'economy' | 'efficient'} ctx.tier
 * @param {import('../types/boiler-types').HotWaterBoilerPowerMatchingScheme} ctx.scheme
 * @param {'apartment' | 'house'} ctx.objectType
 * @param {import('../types/boiler-types').BoilerCircuitFallbackReport | null | undefined} ctx.circuitFallback
 * @param {boolean} ctx.hasWaterHeater
 * @param {boolean} ctx.hasIndirect
 * @returns {{ includeWaterHeater: boolean; includeIndirect: boolean }}
 */
function resolveCompanionFlags({
  tier,
  scheme,
  objectType,
  circuitFallback,
  hasWaterHeater,
  hasIndirect,
}) {
  const activeScheme = circuitFallback?.effectiveScheme ?? scheme;

  if (activeScheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC) {
    return { includeWaterHeater: hasWaterHeater, includeIndirect: false };
  }

  if (activeScheme === SCHEME_BOILER_ELECTRIC_SEPARATE) {
    return { includeWaterHeater: hasWaterHeater, includeIndirect: false };
  }

  if (activeScheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM) {
    return { includeWaterHeater: false, includeIndirect: hasIndirect };
  }

  if (activeScheme === SCHEME_BOILER_MAX_COMBI) {
    if (
      tier === 'efficient' &&
      objectType === 'house' &&
      hasIndirect
    ) {
      return { includeWaterHeater: false, includeIndirect: true };
    }
    return { includeWaterHeater: false, includeIndirect: false };
  }

  return { includeWaterHeater: false, includeIndirect: false };
}

/**
 * @param {import('../types/boiler-types').BoilerEquipmentProposal | null | undefined} proposal
 * @param {import('../types/shared-types').WaterHeaterMatchingReport | undefined} waterHeater
 * @param {import('../types/shared-types').IndirectWaterHeaterMatchingReport | undefined} indirectWaterHeater
 * @param {object} ctx
 * @param {'proposal' | 'economy' | 'efficient'} ctx.tier
 * @param {import('../types/boiler-types').HotWaterBoilerPowerMatchingScheme} ctx.scheme
 * @param {'apartment' | 'house'} ctx.objectType
 * @param {import('../types/boiler-types').BoilerCircuitFallbackReport | null | undefined} [ctx.circuitFallback]
 */
function enrichProposalWithBundlePrice(
  proposal,
  waterHeater,
  indirectWaterHeater,
  ctx,
) {
  if (!proposal || !ctx) return;

  const whCompanion = buildWaterHeaterCompanion(waterHeater);
  const bknCompanion = buildIndirectWaterHeaterCompanion(indirectWaterHeater);
  const flags = resolveCompanionFlags({
    tier: ctx.tier,
    scheme: ctx.scheme,
    objectType: ctx.objectType,
    circuitFallback: ctx.circuitFallback,
    hasWaterHeater: whCompanion != null,
    hasIndirect: bknCompanion != null,
  });

  /** @type {import('../types/boiler-types').EquipmentBundleCompanion[]} */
  const companions = [];
  if (flags.includeWaterHeater && whCompanion) companions.push(whCompanion);
  if (flags.includeIndirect && bknCompanion) companions.push(bknCompanion);
  if (companions.length) {
    proposal.equipmentBundleCompanions = companions;
  }

  /** @type {import('../types/boiler-types').EquipmentBundlePriceBreakdown} */
  const breakdown = {};
  let total = 0;
  let hasAny = false;

  if (
    proposal.estimatedTotalPrice != null &&
    Number.isFinite(proposal.estimatedTotalPrice)
  ) {
    breakdown.boilerPrice = proposal.estimatedTotalPrice;
    total += proposal.estimatedTotalPrice;
    hasAny = true;
  }

  const whPrice =
    flags.includeWaterHeater && whCompanion?.price != null
      ? whCompanion.price
      : null;
  if (whPrice != null) {
    breakdown.waterHeaterPrice = whPrice;
    total += whPrice;
    hasAny = true;
  }

  const bknPrice =
    flags.includeIndirect && bknCompanion?.price != null
      ? bknCompanion.price
      : null;
  if (bknPrice != null) {
    breakdown.indirectWaterHeaterPrice = bknPrice;
    total += bknPrice;
    hasAny = true;
  }

  if (!hasAny) return;

  const hasCompanion =
    breakdown.waterHeaterPrice != null ||
    breakdown.indirectWaterHeaterPrice != null;

  if (!hasCompanion) return;

  proposal.equipmentBundleTotalPrice = Number(total.toFixed(2));
  proposal.equipmentBundlePriceBreakdown = breakdown;
}

/**
 * @param {import('../types/boiler-types').BoilerMatchingReport | null | undefined} boiler
 * @param {import('../types/shared-types').WaterHeaterMatchingReport | undefined} waterHeater
 * @param {import('../types/shared-types').IndirectWaterHeaterMatchingReport | undefined} indirectWaterHeater
 * @param {object} ctx
 * @param {import('../types/boiler-types').HotWaterBoilerPowerMatchingScheme} ctx.scheme
 * @param {'apartment' | 'house'} ctx.objectType
 */
export function enrichBoilerMatchingProposals(
  boiler,
  waterHeater,
  indirectWaterHeater,
  ctx,
) {
  if (!boiler || !ctx) return;
  const base = {
    scheme: ctx.scheme,
    objectType: ctx.objectType,
    circuitFallback: boiler.circuitFallback ?? null,
  };
  enrichProposalWithBundlePrice(boiler.proposal, waterHeater, indirectWaterHeater, {
    ...base,
    tier: 'proposal',
  });
  enrichProposalWithBundlePrice(
    boiler.proposalEconomy,
    waterHeater,
    indirectWaterHeater,
    { ...base, tier: 'economy' },
  );
  enrichProposalWithBundlePrice(
    boiler.proposalEfficient,
    waterHeater,
    indirectWaterHeater,
    { ...base, tier: 'efficient' },
  );
}
