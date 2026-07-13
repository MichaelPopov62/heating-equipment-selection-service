/**
 * Назначение: подбор радиаторов с линиями proposal.
 * Описание: primary Two-Pass → единый resolvedEmitterKind для economy/efficient.
 */
import { applyThermalRegimePresetToHeatingSystem } from '../logic/heatingThermalRegimes.js';
import { pickRadiators } from './internal/pickRadiatorsCore.js';
import {
  buildRadiatorRoomEmitterDiffs,
  emptyRadiatorsEmittersSummary,
  summarizeRadiatorEmitters,
} from './internal/summarizeRadiatorEmitters.js';

/**
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
 * @param {import('../types/shared-types').RadiatorsMatchingReport} tierReport
 * @param {'economy' | 'efficient'} tier
 * @param {import('../types/boiler-types').BoilerEquipmentProposal} boilerProposal
 * @returns {import('../types/shared-types').RadiatorsProposalLineReport}
 */
function wrapRadiatorProposalLine(tierReport, tier, boilerProposal) {
  const emittersSummary =
    tierReport.emittersSummary ?? summarizeRadiatorEmitters(tierReport.byRoom);
  return {
    tier,
    boilerModel: boilerProposal.model ?? null,
    chosen: tierReport.chosen,
    byRoom: tierReport.byRoom,
    inputs: tierReport.inputs,
    warnings: tierReport.warnings,
    radiatorSelectionNotes: tierReport.radiatorSelectionNotes,
    emittersSummary,
    totalSections:
      emittersSummary.sectionalUnits > 0 || emittersSummary.panelUnits > 0
        ? emittersSummary.sectionalSections
        : null,
    resolvedEmitterKind: tierReport.resolvedEmitterKind ?? null,
    emitterKindVotes: tierReport.emitterKindVotes,
    emitterKindDecisionNotes: tierReport.emitterKindDecisionNotes,
  };
}

/**
 * @param {'economy' | 'efficient'} tier
 * @param {string} unavailableReason
 * @returns {import('../types/shared-types').RadiatorsProposalLineReport}
 */
function unavailableRadiatorProposalLine(tier, unavailableReason) {
  return {
    tier,
    boilerModel: null,
    chosen: null,
    byRoom: [],
    warnings: unavailableReason ? [unavailableReason] : [],
    unavailableReason,
    emittersSummary: emptyRadiatorsEmittersSummary(),
    totalSections: null,
    resolvedEmitterKind: null,
  };
}

/**
 * Підбір радіаторів: основна лінія + «Економ» / «Ефективний» з одним kind на объект.
 *
 * @param {object} args
 * @param {import('../types/shared-types').HeatLossReport} args.roomsHeatLoss
 * @param {import('../types/shared-types').HeatingSystemInput} [args.heatingSystem]
 * @param {import('../catalog/types').NormalizedCatalog} args.catalog
 * @param {import('../types/shared-types').BuildingInput | null} [args.building]
 * @param {import('../types/boiler-types').BoilerMatchingReport} args.boiler
 * @param {import('../types/shared-types').UnderfloorHeatingReport | null} [args.underfloorHeating]
 * @param {import('../types/shared-types').HydraulicsSurveyInput | undefined} [args.hydraulics]
 * @param {import('../../dhw/types').RadiatorApplianceRules} [args.radiatorRules]
 * @param {import('../recommendations/types').RecommendationsBundle} [args.recommendations]
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
  radiatorRules = null,
  recommendations = null,
} = {}) {
  const deltaTSystemK = hydraulics?.deltaTSystemK;
  if (heatingSystem?.heatingEmittersMode === 'ufh_only') {
    const skipMsg =
      'Подбор радиаторов пропущен: выбран режим отопления только теплым полом (heatingEmittersMode=ufh_only).';
    return {
      chosen: null,
      byRoom: [],
      emittersSummary: emptyRadiatorsEmittersSummary(),
      totalSections: null,
      roomEmitterDiffs: [],
      warnings: [skipMsg],
      radiatorSelectionNotes: [],
      inputs: {},
      resolvedEmitterKind: null,
      emitterKindVotes: { sectional: 0, panel: 0 },
      emitterKindDecisionNotes: [],
      lineEconomy: unavailableRadiatorProposalLine('economy', skipMsg),
      lineEfficient: unavailableRadiatorProposalLine('efficient', skipMsg),
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
    radiatorRules,
    recommendations,
  });

  const objectKind =
    primary.resolvedEmitterKind === 'sectional' || primary.resolvedEmitterKind === 'panel'
      ? primary.resolvedEmitterKind
      : null;

  /** @type {import('../types/shared-types').RadiatorsProposalLineReport} */
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
      radiatorRules,
      recommendations,
      forcedEmitterKind: objectKind,
    });
    lineEconomy = wrapRadiatorProposalLine(
      ecoReport,
      'economy',
      boiler.proposalEconomy,
    );
  } else {
    lineEconomy = unavailableRadiatorProposalLine(
      'economy',
      'Линия «Эконом» недоступна: в каталоге нет традиционных котлов для этой схемы.',
    );
  }

  /** @type {import('../types/shared-types').RadiatorsProposalLineReport} */
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
      radiatorRules,
      recommendations,
      forcedEmitterKind: objectKind,
    });
    lineEfficient = wrapRadiatorProposalLine(
      effReport,
      'efficient',
      boiler.proposalEfficient,
    );
  } else {
    lineEfficient = unavailableRadiatorProposalLine(
      'efficient',
      'Линия «Эффективный» недоступна: в каталоге нет конденсационных котлов для этой схемы.',
    );
  }

  const roomEmitterDiffs = buildRadiatorRoomEmitterDiffs(
    lineEconomy.byRoom,
    lineEfficient.byRoom,
  );

  /** @type {string[]} */
  const kindChangeWarnings = [];
  for (const diff of roomEmitterDiffs) {
    if (!diff.equipmentKindChanged) continue;
    kindChangeWarnings.push(
      `[${diff.roomName}] Тип прибора различается между линиями «Эконом» (${diff.economyDisplayKind}) `
        + `и «Эффективный» (${diff.efficientDisplayKind}) — нарушение инварианта единого kind.`,
    );
  }

  return {
    ...primary,
    roomEmitterDiffs,
    warnings: [...(primary.warnings ?? []), ...kindChangeWarnings],
    lineEconomy,
    lineEfficient,
  };
}
