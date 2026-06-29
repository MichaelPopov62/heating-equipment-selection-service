/**
 * Назначение: подбор радиаторов с линиями proposal.
 * Описание: обёртка pickRadiators в lineEconomy/lineEfficient с фиксированными графиками
 * traditional_dt50_75_65 и condensing_dt30_55_45; публичный API — pickRadiatorsWithProposalLines.
 */
import { applyThermalRegimePresetToHeatingSystem } from '../logic/heatingThermalRegimes.js';
import { pickRadiators } from './internal/pickRadiatorsCore.js';

/**
 * Сума секцій по приміщеннях.
 * @param {import('../types/shared-types').RadiatorsByRoomItem[]} byRoom
 * @returns {number | null}
 */
function totalSectionsFromByRoom(byRoom) {
  const nums = (byRoom ?? [])
    .map((r) => r.sections)
    .filter((s) => typeof s === 'number' && Number.isFinite(s));
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null;
}

/**
 * Знімок heatingSystem під лінію підбору радіаторів (фіксований пресет графіка).
 * @param {import('../types/shared-types').HeatingSystemInput} baseHeatingSystem
 * @param {'economy' | 'efficient'} tier
 * @returns {import('../types/shared-types').HeatingSystemInput}
 */
function heatingSystemSnapshotForRadiatorTier(baseHeatingSystem, tier) {
  /** @type {import('../types/shared-types').HeatingThermalRegimePreset} */
  const preset =
    tier === 'economy' ? 'traditional_dt50_75_65' : 'condensing_dt30_55_45';
  const hs = structuredClone(baseHeatingSystem ?? {});
  applyThermalRegimePresetToHeatingSystem(hs, preset);
  return hs;
}

/**
 * Обгортка звіту підбору радіаторів у лінію «Економ» / «Ефективний».
 * @param {import('../types/shared-types').RadiatorsMatchingReport} tierReport
 * @param {'economy' | 'efficient'} tier
 * @param {import('../types/boiler-types').BoilerEquipmentProposal} boilerProposal
 * @returns {import('../types/shared-types').RadiatorsProposalLineReport}
 */
function wrapRadiatorProposalLine(tierReport, tier, boilerProposal) {
  return {
    tier,
    boilerModel: boilerProposal.model ?? null,
    chosen: tierReport.chosen,
    byRoom: tierReport.byRoom,
    inputs: tierReport.inputs,
    warnings: tierReport.warnings,
    radiatorSelectionNotes: tierReport.radiatorSelectionNotes,
    totalSections: totalSectionsFromByRoom(tierReport.byRoom),
  };
}

/**
 * Підбір радіаторів: основна лінія (графік з анкети) + рядки «Економ» / «Ефективний»
 * під картки proposalEconomy / proposalEfficient.
 *
 * @param {object} args
 * @param {import('../types/shared-types').HeatLossReport} args.roomsHeatLoss
 * @param {import('../types/shared-types').HeatingSystemInput} [args.heatingSystem]
 * @param {import('../catalog/types').NormalizedCatalog} args.catalog
 * @param {import('../types/shared-types').BuildingInput | null} [args.building]
 * @param {import('../types/boiler-types').BoilerMatchingReport} args.boiler
 * @param {import('../types/shared-types').UnderfloorHeatingReport | null} [args.underfloorHeating]
 * @param {import('../types/shared-types').HydraulicsSurveyInput | undefined} [args.hydraulics]
 * @returns {import('../types/shared-types').RadiatorsMatchingReport}
 */
export function pickRadiatorsWithProposalLines({
  roomsHeatLoss,
  heatingSystem = {},
  catalog,
  building = null,
  boiler,
  underfloorHeating = null,
  hydraulics,
} = {}) {
  const deltaTSystemK = hydraulics?.deltaTSystemK;
  if (heatingSystem?.heatingEmittersMode === 'ufh_only') {
    const skipMsg =
      'Подбор радиаторов пропущен: выбран режим отопления только теплым полом (heatingEmittersMode=ufh_only).';
    return {
      chosen: null,
      byRoom: [],
      warnings: [skipMsg],
      radiatorSelectionNotes: [],
      inputs: {},
      lineEconomy: {
        tier: 'economy',
        boilerModel: null,
        chosen: null,
        byRoom: [],
        warnings: [skipMsg],
        unavailableReason: skipMsg,
        totalSections: null,
      },
      lineEfficient: {
        tier: 'efficient',
        boilerModel: null,
        chosen: null,
        byRoom: [],
        warnings: [skipMsg],
        unavailableReason: skipMsg,
        totalSections: null,
      },
    };
  }

  /** @type {import('../types/shared-types').RadiatorsProposalLineReport | undefined} */
  let lineEconomy;
  if (boiler?.proposalEconomy) {
    const hsEco = heatingSystemSnapshotForRadiatorTier(heatingSystem, 'economy');
    const ecoReport = pickRadiators({
      roomsHeatLoss,
      heatingSystem: hsEco,
      catalog,
      building,
      boilerMatching: null,
      radiatorLineTier: 'economy',
      underfloorHeating,
      deltaTSystemK,
    });
    lineEconomy = wrapRadiatorProposalLine(
      ecoReport,
      'economy',
      boiler.proposalEconomy,
    );
  } else {
    lineEconomy = {
      tier: 'economy',
      boilerModel: null,
      chosen: null,
      byRoom: [],
      warnings: [],
      unavailableReason:
        'Линия «Эконом» недоступна: в каталоге нет традиционных котлов для этой схемы.',
      totalSections: null,
    };
  }

  /** @type {import('../types/shared-types').RadiatorsProposalLineReport | undefined} */
  let lineEfficient;
  if (boiler?.proposalEfficient) {
    const hsEff = heatingSystemSnapshotForRadiatorTier(heatingSystem, 'efficient');
    const effReport = pickRadiators({
      roomsHeatLoss,
      heatingSystem: hsEff,
      catalog,
      building,
      boilerMatching: null,
      radiatorLineTier: 'efficient',
      underfloorHeating,
      deltaTSystemK,
    });
    lineEfficient = wrapRadiatorProposalLine(
      effReport,
      'efficient',
      boiler.proposalEfficient,
    );
  } else {
    lineEfficient = {
      tier: 'efficient',
      boilerModel: null,
      chosen: null,
      byRoom: [],
      warnings: [],
      unavailableReason:
        'Линия «Эффективный» недоступна: в каталоге нет конденсационных котлов для этой схемы.',
      totalSections: null,
    };
  }

  const primary = pickRadiators({
    roomsHeatLoss,
    heatingSystem,
    catalog,
    building,
    boilerMatching: boiler,
    underfloorHeating,
    deltaTSystemK,
  });

  return {
    ...primary,
    lineEconomy,
    lineEfficient,
  };
}
