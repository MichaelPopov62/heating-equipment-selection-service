/**
 * Назначение: Разбор proposal котла из отчёта.
 * Описание: Преобразование узла matching.boiler.proposal* в данные для карточки.
 */

import type { BoilerProposalView } from '../components/BoilerProposalCard/BoilerProposalCard';
import { isRecord, readStringArray } from './jsonGuards';

/** Разбирает узел proposal из отчёта API в вид для BoilerProposalCard. */
export function parseBoilerProposalPayload(raw: unknown): BoilerProposalView | null {
  if (!isRecord(raw)) return null;
  const p = raw;
  const kind = p.kind;
  if (kind !== 'single' && kind !== 'cascade') return null;
  const headline = typeof p.headline === 'string' ? p.headline : '';
  const model = typeof p.model === 'string' ? p.model : '';
  if (!headline || !model) return null;
  const unitsCount = typeof p.unitsCount === 'number' ? p.unitsCount : NaN;
  const unitMaxPowerKw = typeof p.unitMaxPowerKw === 'number' ? p.unitMaxPowerKw : NaN;
  const totalNominalKw = typeof p.totalNominalKw === 'number' ? p.totalNominalKw : NaN;
  const requiredKw = typeof p.requiredKw === 'number' ? p.requiredKw : NaN;
  const nominalReservePercent =
    typeof p.nominalReservePercent === 'number' ? p.nominalReservePercent : NaN;

  const br = p.powerRequirementBreakdown;
  if (!isRecord(br)) return null;
  const breakdownHeating =
    typeof br.heatingLoadKw === 'number' && Number.isFinite(br.heatingLoadKw)
      ? br.heatingLoadKw
      : NaN;
  const breakdownDhw =
    typeof br.hotWaterPowerKw === 'number' && Number.isFinite(br.hotWaterPowerKw)
      ? br.hotWaterPowerKw
      : NaN;

  if (
    !Number.isFinite(unitsCount)
    || !Number.isFinite(unitMaxPowerKw)
    || !Number.isFinite(totalNominalKw)
    || !Number.isFinite(requiredKw)
    || !Number.isFinite(nominalReservePercent)
    || !Number.isFinite(breakdownHeating)
    || !Number.isFinite(breakdownDhw)
  ) {
    return null;
  }
  const advantages = readStringArray(p.advantages);
  const notes = readStringArray(p.notes);
  const mountingType = p.mountingType === 'wall' || p.mountingType === 'floor' ? p.mountingType : undefined;
  const connectionDiametersRaw = p.connectionDiameters;
  const connectionDiameters = Array.isArray(connectionDiametersRaw)
    ? readStringArray(connectionDiametersRaw)
    : undefined;
  const estimatedTotalPrice =
    typeof p.estimatedTotalPrice === 'number' && Number.isFinite(p.estimatedTotalPrice)
      ? p.estimatedTotalPrice
      : undefined;
  const equipmentBundleTotalPrice =
    typeof p.equipmentBundleTotalPrice === 'number' &&
    Number.isFinite(p.equipmentBundleTotalPrice)
      ? p.equipmentBundleTotalPrice
      : undefined;
  const brRaw = p.equipmentBundlePriceBreakdown;
  let equipmentBundlePriceBreakdown:
    | import('../components/BoilerProposalCard/BoilerProposalCard').EquipmentBundlePriceBreakdownView
    | undefined;
  if (isRecord(brRaw)) {
    const boilerPrice =
      typeof brRaw.boilerPrice === 'number' && Number.isFinite(brRaw.boilerPrice)
        ? brRaw.boilerPrice
        : undefined;
    const waterHeaterPrice =
      typeof brRaw.waterHeaterPrice === 'number' &&
      Number.isFinite(brRaw.waterHeaterPrice)
        ? brRaw.waterHeaterPrice
        : undefined;
    const indirectWaterHeaterPrice =
      typeof brRaw.indirectWaterHeaterPrice === 'number' &&
      Number.isFinite(brRaw.indirectWaterHeaterPrice)
        ? brRaw.indirectWaterHeaterPrice
        : undefined;
    if (
      boilerPrice != null ||
      waterHeaterPrice != null ||
      indirectWaterHeaterPrice != null
    ) {
      equipmentBundlePriceBreakdown = {
        boilerPrice,
        waterHeaterPrice,
        indirectWaterHeaterPrice,
      };
    }
  }
  const tier = p.tier === 'economy' || p.tier === 'efficient' ? p.tier : undefined;

  const companionsRaw = p.equipmentBundleCompanions;
  let equipmentBundleCompanions:
    | import('../components/BoilerProposalCard/BoilerProposalCard').EquipmentBundleCompanionView[]
    | undefined;
  if (Array.isArray(companionsRaw)) {
    const parsed: import('../components/BoilerProposalCard/BoilerProposalCard').EquipmentBundleCompanionView[] =
      [];
    for (const item of companionsRaw) {
      if (!isRecord(item)) continue;
      const role = item.role;
      if (role !== 'water_heater' && role !== 'indirect_water_heater') continue;
      const model = typeof item.model === 'string' ? item.model.trim() : '';
      if (!model) continue;
      const brand =
        typeof item.brand === 'string' && item.brand.trim()
          ? item.brand.trim()
          : undefined;
      const volumeLiters =
        typeof item.volumeLiters === 'number' && Number.isFinite(item.volumeLiters)
          ? item.volumeLiters
          : undefined;
      const price =
        typeof item.price === 'number' && Number.isFinite(item.price)
          ? item.price
          : undefined;
      parsed.push({ role, model, brand, volumeLiters, price });
    }
    if (parsed.length) equipmentBundleCompanions = parsed;
  }

  return {
    kind,
    headline,
    model,
    unitsCount,
    unitMaxPowerKw,
    totalNominalKw,
    requiredKw,
    powerRequirementBreakdown: {
      heatingLoadKw: breakdownHeating,
      hotWaterPowerKw: breakdownDhw,
    },
    nominalReservePercent,
    estimatedTotalPrice,
    equipmentBundleTotalPrice,
    equipmentBundlePriceBreakdown,
    equipmentBundleCompanions,
    mountingType,
    connectionDiameters:
      connectionDiameters && connectionDiameters.length > 0 ? connectionDiameters : undefined,
    advantages,
    notes,
    tier,
  };
}
