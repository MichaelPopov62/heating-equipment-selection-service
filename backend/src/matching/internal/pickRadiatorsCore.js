/**
 * Назначение: ядро подбора радиаторов (Two-Pass Orchestrator).
 * Описание: Pass 1 — голоса kind; Pass 2 — forced kind + эскалация; единый тип на объект.
 */
import { round } from '../../utils/math.js';
import { resolveFlowDeltaTK } from '../../hydraulics/resolveFlowDeltaTK.js';
import { thermalLoadToFlow } from '../../hydraulics/thermalLoadToFlow.js';
import { logger } from '../../utils/logger.js';
import { buildWarmFloorMatchingNotes } from '../warmFloor.js';
import { buildRadiatorConnectionSelectionNotes } from './radiatorConnectionNotes.js';
import {
  buildUfhHeatFluxUpWattsByRoomId,
  resolveMixedRadiatorRoomLoad,
} from './resolveMixedRadiatorRoomLoad.js';
import { resolveMicroLoadRadiatorStrategy } from './resolveMicroLoadRadiatorStrategy.js';
import { summarizeRadiatorEmitters } from './summarizeRadiatorEmitters.js';
import { resolveRecommendation } from '../../recommendations/recommendationResolver.js';
import { isMixedRadiatorsUfhHeatingMode } from './mixedRadiatorsUfhMode.js';
import { resolveKVent } from '../../logic/ventilationReserve.js';
import { resolveDesignRoomAirTempC } from '../../../../shared/roomDesignAirTemp.js';
import {
  normalizeRadiatorEmitterPreference,
  radiatorEmitterPreferenceLabel,
} from '../../../../shared/radiatorEmitterPreference.js';
import {
  adjustOutputWatts,
  filterPanelsByConnection,
  isPanelRadiator,
  isSectionalRadiator,
} from '../radiatorSizingHelpers.js';
import { decideObjectEmitterKind } from './decideObjectEmitterKind.js';
import { exploreRoomEmitterKindVote } from './exploreRoomEmitterKind.js';
import {
  pickMinimumViableForcedKind,
  sizeForcedRoomEmitter,
} from './sizeForcedRoomEmitter.js';

/** @type {import('../../dhw/types.js').RadiatorEmitterKindRules} */
const DEFAULT_EMITTER_KIND_RULES = Object.freeze({
  maxSectionsBeforeMultiUnit: 24,
  maxUnitsPerRoom: 4,
  maxSectionsHeuristic: 80,
  sectionalCandidatesPerRoom: 16,
  tieBreakKind: 'sectional',
});

/**
 * @param {'panel' | 'section'} kind
 * @param {number} adjustedWatts
 * @param {number | null | undefined} sections
 * @param {number} [unitsCount]
 */
function emitterFieldsFromSized(kind, adjustedWatts, sections, unitsCount = 1) {
  const units = Math.max(1, Math.trunc(unitsCount) || 1);
  if (kind === 'panel') {
    return {
      outputPerSectionWatts: 0,
      deliverableWatts: Math.max(0, Math.round(adjustedWatts * units)),
      unitsCount: units,
      displayKind: /** @type {'panel'} */ ('panel'),
      priceBasis: /** @type {'panel'} */ ('panel'),
    };
  }
  const sec = typeof sections === 'number' && Number.isFinite(sections) ? sections : 1;
  const perSection = Math.max(1, Math.round(adjustedWatts));
  return {
    outputPerSectionWatts: perSection,
    deliverableWatts: Math.round(perSection * sec * units),
    unitsCount: units,
    displayKind: /** @type {'sectional'} */ ('sectional'),
    priceBasis: /** @type {'section'} */ ('section'),
  };
}

/**
 * Ціна позиції каталогу для смети (report.commercial).
 *
 * @param {import('../../catalog/types.js').RadiatorCatalogItemNormalized | null | undefined} radiator
 * @returns {{ unitPriceUah?: number }}
 */
function radiatorCommercialPriceFields(radiator) {
  if (
    radiator
    && typeof radiator.price === 'number'
    && Number.isFinite(radiator.price)
    && radiator.price > 0
  ) {
    return { unitPriceUah: radiator.price };
  }
  return {};
}

/**
 * @param {Pick<import('../../types/shared-types.js').RadiatorsByRoomItem, 'roomId' | 'roomName' | 'heatLossWatts' | 'radiatorDesignWatts'> & {
 *   designAirTempC?: number;
 *   designAirTempSource?: import('../../types/shared-types.js').DesignRoomAirTempSource;
 *   flowRateM3PerHour?: number;
 *   radiatorModel?: string;
 *   warnings?: string[];
 *   sizingNotes?: string[];
 * }} base
 * @returns {import('../../types/shared-types.js').RadiatorsByRoomItem}
 */
function skippedRoomEmitter(base) {
  return {
    roomId: base.roomId,
    roomName: base.roomName,
    heatLossWatts: base.heatLossWatts,
    radiatorDesignWatts: base.radiatorDesignWatts,
    ...(base.designAirTempC != null ? { designAirTempC: base.designAirTempC } : {}),
    ...(base.designAirTempSource != null
      ? { designAirTempSource: base.designAirTempSource }
      : {}),
    ...(base.flowRateM3PerHour != null
      ? { flowRateM3PerHour: base.flowRateM3PerHour }
      : {}),
    radiatorModel: base.radiatorModel ?? '—',
    outputPerSectionWatts: 0,
    sections: null,
    deliverableWatts: 0,
    displayKind: /** @type {'none'} */ ('none'),
    ...(base.warnings ? { warnings: base.warnings } : {}),
    ...(base.sizingNotes ? { sizingNotes: base.sizingNotes } : {}),
  };
}

/**
 * @param {{ supplyC: number, returnC: number, insideC: number }} args
 * @returns {number}
 */
function deltaTmeanK({ supplyC, returnC, insideC }) {
  return (supplyC + returnC) / 2 - insideC;
}

/**
 * @param {import('../../catalog/types.js').RadiatorCatalogItemNormalized} r
 * @param {50 | 70} baseDeltaT
 */
function sectionOutputPassport(r, baseDeltaT) {
  return baseDeltaT === 70 ? r.outputWatts.deltaT70 : r.outputWatts.deltaT50;
}

/**
 * @param {import('../../catalog/types.js').RadiatorCatalogItemNormalized} r
 * @param {'individual' | 'central'} heatingDistribution
 * @param {'side' | 'bottom' | undefined} connection
 */
function radiatorBrandPreferenceScore(r, heatingDistribution, connection) {
  const m = String(r?.model ?? '').toLowerCase();
  const mat = String(r?.material ?? '').toLowerCase();
  let score = 0;
  if (heatingDistribution === 'central') {
    if (m.includes('mirado') || mat.includes('бимет')) score += 120;
    if (m.includes('global')) score += 60;
  } else {
    if (m.includes('fondital')) score += 120;
    if (m.includes('radik')) score += 100;
    if (m.includes('korado')) score += 100;
    if (m.includes('global')) score += 70;
    if (m.includes('exclusivo') || m.includes('blitz')) score += 50;
    if (m.includes('mirado') || mat.includes('бимет')) score -= 40;
  }
  if (connection === 'bottom') {
    if (/\bvkp\b|\b\d{2}vk\b/i.test(m)) score += 60;
    if (isPanelRadiator(r)) score += 20;
  } else if (connection === 'side') {
    if (/-k\b|klasik|секцион|b3|b4/i.test(m)) score += 30;
  }
  return score;
}

/**
 * @param {import('../../catalog/types.js').RadiatorCatalogItemNormalized} r
 * @param {50 | 70} baseDeltaT
 * @param {'individual' | 'central'} heatingDistribution
 * @param {'side' | 'bottom' | undefined} connection
 */
function radiatorCompositeRank(r, baseDeltaT, heatingDistribution, connection) {
  const w = sectionOutputPassport(r, baseDeltaT);
  const b = radiatorBrandPreferenceScore(r, heatingDistribution, connection);
  if (heatingDistribution === 'individual') return w + b * 0.38;
  return w + b * 0.08;
}

/**
 * @param {import('../../catalog/types.js').RadiatorCatalogItemNormalized[]} radiators
 * @param {50 | 70} baseDeltaT
 * @param {'individual' | 'central'} heatingDistribution
 * @param {'side' | 'bottom' | undefined} connection
 */
function sortRadiatorsForMatching(radiators, baseDeltaT, heatingDistribution, connection) {
  return [...radiators].sort((a, b) => {
    const ra = radiatorCompositeRank(a, baseDeltaT, heatingDistribution, connection);
    const rb = radiatorCompositeRank(b, baseDeltaT, heatingDistribution, connection);
    if (rb !== ra) return rb - ra;
    return sectionOutputPassport(b, baseDeltaT) - sectionOutputPassport(a, baseDeltaT);
  });
}

/**
 * @param {import('../../dhw/types.js').RadiatorApplianceRules | null | undefined} radiatorRules
 * @returns {import('../../dhw/types.js').RadiatorEmitterKindRules}
 */
function resolveEmitterKindRules(radiatorRules) {
  return radiatorRules?.emitterKind ?? DEFAULT_EMITTER_KIND_RULES;
}

/**
 * Підбір радіаторів: Two-Pass — голоса kind → глобальный lock → sizing с эскалацией.
 *
 * @param {object} args
 * @param {import('../../types/shared-types.js').HeatLossReport} args.roomsHeatLoss
 * @param {import('../../types/shared-types.js').HeatingSystemInput} [args.heatingSystem]
 * @param {import('../../catalog/types.js').NormalizedCatalog} args.catalog
 * @param {string|null} [args.radiatorModel]
 * @param {import('../../types/shared-types.js').BuildingInput | null} [args.building]
 * @param {import('../../types/boiler-types.js').BoilerMatchingReport | null} [args.boilerMatching]
 * @param {'economy' | 'efficient' | null} [args.radiatorLineTier]
 * @param {import('../../types/shared-types.js').UnderfloorHeatingReport | null} [args.underfloorHeating]
 * @param {number | undefined} [args.deltaTSystemK]
 * @param {import('../../dhw/types.js').RadiatorApplianceRules | null | undefined} [args.radiatorRules]
 * @param {import('../../recommendations/types.js').RecommendationsBundle | null | undefined} [args.recommendations]
 * @param {'sectional' | 'panel' | null} [args.forcedEmitterKind] - от primary для eco/eff
 * @returns {import('../../types/shared-types.js').RadiatorsMatchingReport}
 */
export function pickRadiators({
  roomsHeatLoss,
  heatingSystem = {},
  catalog,
  radiatorModel = null,
  building = null,
  boilerMatching = null,
  radiatorLineTier = null,
  underfloorHeating = null,
  deltaTSystemK,
  radiatorRules = null,
  recommendations = null,
  forcedEmitterKind = null,
}) {
  const supplyC = heatingSystem.supplyC ?? 75;
  const returnC = heatingSystem.returnC ?? 65;
  const insideC = heatingSystem.insideC ?? 20;
  const bathroomAirTempC =
    typeof building?.temps?.bathroomAirTempC === 'number'
    && Number.isFinite(building.temps.bathroomAirTempC)
      ? building.temps.bathroomAirTempC
      : undefined;

  const hasEfficientProposal =
    radiatorLineTier === 'efficient'
    || (radiatorLineTier == null && Boolean(boilerMatching?.proposalEfficient));
  let baseDeltaT = /** @type {50 | 70 | undefined} */ (heatingSystem.radiatorReferenceDeltaT);
  if (baseDeltaT == null) {
    if (radiatorLineTier === 'economy') {
      baseDeltaT = 70;
    } else if (radiatorLineTier === 'efficient') {
      baseDeltaT = 50;
    } else {
      baseDeltaT = hasEfficientProposal ? 50 : 70;
    }
  }

  const heatingDistribution =
    building?.objectMeta?.heatingDistribution === 'central' ? 'central' : 'individual';
  const radiatorConnection = heatingSystem.radiatorConnection;
  const radiatorEmitterPreference = normalizeRadiatorEmitterPreference(
    heatingSystem.radiatorEmitterPreference,
  );
  const ventilationReserveFactor = resolveKVent(
    building?.objectMeta?.ventilationReserveMode,
  );
  const emitterKindRules = resolveEmitterKindRules(radiatorRules);

  const targetDeltaT = deltaTmeanK({ supplyC, returnC, insideC });
  const flowDeltaTK = resolveFlowDeltaTK({ deltaTSystemK, supplyC, returnC });
  /**
   * @param {number} watts
   * @returns {number}
   */
  const radiatorFlowM3h = (watts) =>
    thermalLoadToFlow({
      heatLoadWatts: watts,
      deltaTK: flowDeltaTK,
    }).flowRateM3PerHour;

  logger.info('matching.radiators.start', null, {
    baseDeltaT,
    targetDeltaT: round(targetDeltaT, 1),
    rooms: roomsHeatLoss?.rooms?.length ?? 0,
    radiatorModel,
    heatingDistribution,
    radiatorConnection: radiatorConnection ?? null,
    radiatorEmitterPreference,
    forcedEmitterKind,
    hasEfficientProposal,
    waterUnderfloorHeating: Boolean(heatingSystem.waterUnderfloorHeating),
    thermalRegimePreset: heatingSystem.thermalRegimePreset ?? null,
    ventilationReserveFactor,
  });

  const allRadiators = catalog?.radiators ?? [];
  const sectionalPool = allRadiators.filter((r) => isSectionalRadiator(r));
  const panelPoolRaw = allRadiators.filter((r) => isPanelRadiator(r));
  const panelPoolFiltered = filterPanelsByConnection(panelPoolRaw, radiatorConnection);

  /** @type {string[]} */
  const radiatorSelectionNotes = [];
  if (panelPoolRaw.length > 0) {
    radiatorSelectionNotes.push(
      `В каталоге ${panelPoolRaw.length} панельных позиций (priceBasis=panel): `
        + 'подбор по длине SKU и мощности на прибор; секции в отчёте не применяются.',
    );
  }
  if (
    radiatorConnection === 'bottom'
    && panelPoolFiltered.length === 0
    && panelPoolRaw.length > 0
  ) {
    radiatorSelectionNotes.push(
      'Для нижней подводки в каталоге нет панелей VKP/нижнего подключения — '
        + 'рассмотрите секционные модели или дополните каталог.',
    );
  }
  if (radiatorConnection === 'bottom' && panelPoolRaw.length === 0) {
    radiatorSelectionNotes.push(
      'Запрошена нижняя подводка, но панельных моделей в каталоге нет.',
    );
  }

  radiatorSelectionNotes.push(
    `Предпочтение типа приборов: ${radiatorEmitterPreferenceLabel(radiatorEmitterPreference)} `
      + `(heatingSystem.radiatorEmitterPreference=${radiatorEmitterPreference}).`,
  );

  if (hasEfficientProposal) {
    const passportHighDeltaT = 70;
    const lowSupplyC = 55;
    const lowReturnC = 45;
    const lowTargetDeltaT = deltaTmeanK({
      supplyC: lowSupplyC,
      returnC: lowReturnC,
      insideC,
    });
    const refWatts = 100;
    const atLow = adjustOutputWatts({
      baseWatts: refWatts,
      baseDeltaT: passportHighDeltaT,
      targetDeltaT: lowTargetDeltaT,
    });
    const relOut = atLow / refWatts;
    const sectionScale = relOut > 0 ? 1 / relOut : 0;
    radiatorSelectionNotes.push(
      `Конденсационный контур: при ориентировочном графике ${lowSupplyC}/${lowReturnC} °C и ${insideC} °C `
        + `в помещении средний температурный напор радиатора ≈ ${round(lowTargetDeltaT, 1)} К `
        + `(для сравнения — типичный паспорт ΔT≈70 К при ~90/70 °C). По степенной модели (n≈1,3) `
        + `удельная теплоотдача падает ≈в ${relOut > 0 ? (1 / relOut).toFixed(1) : '—'} раз — `
        + `ориентировочно требуется ≈в ${sectionScale > 0 ? sectionScale.toFixed(1) : '—'} раз `
        + 'больше секций/поверхности прибора, чем в высокотемпературной системе.',
    );
  }

  radiatorSelectionNotes.push(...buildRadiatorConnectionSelectionNotes(radiatorConnection));
  radiatorSelectionNotes.push(...buildWarmFloorMatchingNotes(heatingSystem));

  const ufhHeatFluxByRoomId = buildUfhHeatFluxUpWattsByRoomId(underfloorHeating);
  const applyUfhRadiatorOffset = isMixedRadiatorsUfhHeatingMode(heatingSystem);
  if (applyUfhRadiatorOffset && ufhHeatFluxByRoomId.size > 0) {
    radiatorSelectionNotes.push(
      'Смешанный режим (радиаторы + ТП): нагрузка на радиатор уменьшается на отдачу тёплого пола '
        + 'вверх (heatFluxUpWatts) по каждой комнате с ТП — без двойного учёта мощности.',
    );
  }

  const sortedSectional = sortRadiatorsForMatching(
    radiatorModel
      ? sectionalPool.filter((r) => r.model === radiatorModel)
      : sectionalPool,
    baseDeltaT,
    heatingDistribution,
    radiatorConnection,
  );

  /** @type {NonNullable<import('../../types/shared-types.js').RadiatorsMatchingReport['inputs']>} */
  const emptyInputs = {
    supplyC,
    returnC,
    insideC,
    baseDeltaT,
    targetDeltaT: round(targetDeltaT, 1),
    ventilationReserveFactor,
    radiatorSizingAlignedWithCondensing: hasEfficientProposal,
    heatingDistribution,
    ...(radiatorConnection != null ? { radiatorConnection } : {}),
    radiatorEmitterPreference,
    ...(heatingSystem.thermalRegimePreset != null
      ? { thermalRegimePreset: heatingSystem.thermalRegimePreset }
      : {}),
  };

  if (sectionalPool.length === 0 && panelPoolRaw.length === 0) {
    logger.warn('matching.radiators.emptyCatalog', null);
    return {
      chosen: null,
      byRoom: [],
      emittersSummary: summarizeRadiatorEmitters([]),
      totalSections: null,
      warnings: ['В каталоге нет радиаторов.'],
      inputs: emptyInputs,
      radiatorSelectionNotes,
      resolvedEmitterKind: null,
      emitterKindVotes: { sectional: 0, panel: 0 },
      emitterKindDecisionNotes: [],
    };
  }

  /** @type {Map<string, number>} */
  const maxWindowWidthByRoom = new Map();
  /** @type {Map<string, number>} */
  const maxWindowHeightByRoom = new Map();
  const envelopeElements = building?.envelopeElements ?? [];
  for (const el of envelopeElements) {
    const kind = el?.kind ?? null;
    const construction = String(el?.construction ?? '').toLowerCase();
    const isWindow = kind === 'window' || construction.includes('окно');
    if (!isWindow) continue;
    const roomId = String(el?.roomId ?? '');
    if (!roomId) continue;
    const w = el?.openingWidthMm;
    if (typeof w === 'number' && Number.isFinite(w) && w > 0) {
      const prev = maxWindowWidthByRoom.get(roomId) ?? 0;
      if (w > prev) maxWindowWidthByRoom.set(roomId, w);
    }
    const h = el?.openingHeightMm;
    if (typeof h === 'number' && Number.isFinite(h) && h > 0) {
      const prevH = maxWindowHeightByRoom.get(roomId) ?? 0;
      if (h > prevH) maxWindowHeightByRoom.set(roomId, h);
    }
  }

  const minRoomWattsForWindowWidthRule = 800;

  /**
   * @typedef {object} RoomPrep
   * @property {string} roomId
   * @property {string} roomName
   * @property {number} roomInsideC
   * @property {import('../../../../shared/roomDesignAirTemp.js').DesignRoomAirTempSource | 'survey'} airSource
   * @property {number} roomTargetDeltaT
   * @property {number} qEnvelope
   * @property {number} qRad
   * @property {string[]} mixedNotes
   * @property {'skip' | 'minimum_viable' | 'normal'} action
   * @property {string[]} microNotes
   */

  /** @type {RoomPrep[]} */
  const roomPreps = [];
  /** @type {Set<string>} */
  const microRecCodes = new Set();

  for (const room of roomsHeatLoss?.rooms ?? []) {
    const roomType =
      room.type ?? building?.rooms?.find((r) => r.id === room.id)?.type;
    const air =
      typeof room.designAirTempC === 'number' && Number.isFinite(room.designAirTempC)
        ? {
            designAirTempC: room.designAirTempC,
            source: /** @type {import('../../../../shared/roomDesignAirTemp.js').DesignRoomAirTempSource} */ (
              room.designAirTempSource ?? 'survey'
            ),
          }
        : resolveDesignRoomAirTempC({
            ...(roomType !== undefined ? { roomType } : {}),
            insideC,
            ...(bathroomAirTempC !== undefined ? { bathroomAirTempC } : {}),
          });
    const roomInsideC = air?.designAirTempC ?? insideC;
    const roomTargetDeltaT = deltaTmeanK({
      supplyC,
      returnC,
      insideC: roomInsideC,
    });

    const qEnvelope = room.envelopeWatts ?? 0;
    const qDesignFull = room.designWatts ?? qEnvelope * ventilationReserveFactor;
    const mixedLoad = resolveMixedRadiatorRoomLoad({
      designWattsFull: qDesignFull,
      ufhHeatFluxUpWatts: applyUfhRadiatorOffset
        ? ufhHeatFluxByRoomId.get(room.id)
        : undefined,
    });
    const qRad = mixedLoad.qRad;

    if (mixedLoad.skipRadiator) {
      roomPreps.push({
        roomId: room.id,
        roomName: room.name,
        roomInsideC,
        airSource: air?.source ?? 'survey',
        roomTargetDeltaT,
        qEnvelope,
        qRad: 0,
        mixedNotes: mixedLoad.sizingNotes,
        action: 'skip',
        microNotes: [],
      });
      continue;
    }

    const microRules = radiatorRules?.microLoad ?? null;
    /** @type {'skip' | 'minimum_viable' | 'normal'} */
    let action = 'normal';
    /** @type {string[]} */
    let microNotes = [];

    if (microRules) {
      const microStrategy = resolveMicroLoadRadiatorStrategy({
        rules: microRules,
        room,
        building,
        qRad,
      });
      if (microStrategy.action === 'skip') {
        microRecCodes.add('REC_RADIATOR_MICRO_LOAD_SKIP');
        action = 'skip';
        microNotes = microStrategy.sizingNotes;
      } else if (microStrategy.action === 'minimum_viable') {
        microRecCodes.add('REC_RADIATOR_ENTRY_ZONE_MINIMUM');
        action = 'minimum_viable';
        microNotes = microStrategy.sizingNotes;
      }
    }

    roomPreps.push({
      roomId: room.id,
      roomName: room.name,
      roomInsideC,
      airSource: air?.source ?? 'survey',
      roomTargetDeltaT,
      qEnvelope,
      qRad,
      mixedNotes: mixedLoad.sizingNotes,
      action,
      microNotes,
    });
  }

  // ——— Pass 1: голоса (только при auto и без forced override) ———
  /** @type {import('./decideObjectEmitterKind.js').EmitterKindVote[]} */
  const votes = [];
  const needExplore =
    forcedEmitterKind == null
    && radiatorEmitterPreference === 'auto';

  if (needExplore) {
    for (const prep of roomPreps) {
      if (prep.action === 'skip' || prep.qRad <= 0) continue;
      const vote = exploreRoomEmitterKindVote({
        qRad: prep.qRad,
        sectionalPool: sortedSectional,
        panelPoolFiltered,
        baseDeltaT,
        targetDeltaT: prep.roomTargetDeltaT,
        radiatorConnection,
        windowOpeningWidthMm: maxWindowWidthByRoom.get(prep.roomId) ?? null,
        maxSectionsBeforeMultiUnit: emitterKindRules.maxSectionsBeforeMultiUnit,
        maxSectionsHeuristic: emitterKindRules.maxSectionsHeuristic,
        sectionalCandidatesPerRoom: emitterKindRules.sectionalCandidatesPerRoom,
        ventilationReserveFactor,
      });
      if (!vote) continue;
      votes.push({
        roomId: prep.roomId,
        roomName: prep.roomName,
        preferredKind: vote.preferredKind,
        reason: vote.reason,
      });
    }
  }

  const decision = decideObjectEmitterKind({
    preference: radiatorEmitterPreference,
    votes,
    forcedOverride: forcedEmitterKind,
    tieBreakKind: emitterKindRules.tieBreakKind,
  });

  const resolvedKind = decision.resolvedEmitterKind;
  radiatorSelectionNotes.push(...decision.emitterKindDecisionNotes);

  // ——— Pass 2: финальный sizing ———
  /** @type {import('../../types/shared-types.js').RadiatorsByRoomItem[]} */
  const byRoom = [];
  let anyMultiUnit = false;
  /** @type {Set<string>} */
  const underpoweredRoomIds = new Set();

  for (const prep of roomPreps) {
    if (prep.action === 'skip') {
      byRoom.push(
        skippedRoomEmitter({
          roomId: prep.roomId,
          roomName: prep.roomName,
          designAirTempC: prep.roomInsideC,
          designAirTempSource: prep.airSource,
          heatLossWatts: prep.qEnvelope,
          radiatorDesignWatts: 0,
          flowRateM3PerHour: 0,
          radiatorModel: '—',
          warnings: [],
          sizingNotes: [...prep.mixedNotes, ...prep.microNotes],
        }),
      );
      continue;
    }

    if (prep.action === 'minimum_viable') {
      const minSized = pickMinimumViableForcedKind({
        forcedKind: resolvedKind,
        sectionalPool: sortedSectional,
        panelPoolFiltered,
        baseDeltaT,
        targetDeltaT: prep.roomTargetDeltaT,
        windowOpeningWidthMm: maxWindowWidthByRoom.get(prep.roomId) ?? null,
        openingHeightMm: maxWindowHeightByRoom.get(prep.roomId) ?? null,
      });

      if (!minSized) {
        byRoom.push(
          skippedRoomEmitter({
            roomId: prep.roomId,
            roomName: prep.roomName,
            designAirTempC: prep.roomInsideC,
            designAirTempSource: prep.airSource,
            heatLossWatts: prep.qEnvelope,
            radiatorDesignWatts: Math.round(prep.qRad),
            flowRateM3PerHour: radiatorFlowM3h(prep.qRad),
            radiatorModel: '—',
            warnings: [
              `Не удалось подобрать минимальный ${resolvedKind} радиатор для входной зоны.`,
            ],
            sizingNotes: [...prep.mixedNotes, ...prep.microNotes],
          }),
        );
        continue;
      }

      const emitter = emitterFieldsFromSized(
        minSized.kind === 'panel' ? 'panel' : 'section',
        minSized.adjustedWatts,
        minSized.sections,
        minSized.unitsCount,
      );
      const microThreshold =
        radiatorRules?.microLoad?.minDesignWattsThreshold ?? 150;
      const hydraulicsWatts = Math.max(
        prep.qRad,
        emitter.deliverableWatts,
        microThreshold,
      );

      byRoom.push({
        roomId: prep.roomId,
        roomName: prep.roomName,
        designAirTempC: prep.roomInsideC,
        designAirTempSource: prep.airSource,
        heatLossWatts: prep.qEnvelope,
        radiatorDesignWatts: Math.round(hydraulicsWatts),
        flowRateM3PerHour: radiatorFlowM3h(hydraulicsWatts),
        radiatorModel: minSized.radiator.model,
        outputPerSectionWatts: emitter.outputPerSectionWatts,
        sections: minSized.sections,
        sectionsThermalMin: minSized.sectionsThermalMin ?? minSized.sections,
        unitsCount: emitter.unitsCount,
        deliverableWatts: emitter.deliverableWatts,
        displayKind: emitter.displayKind,
        windowOpeningWidthMm: maxWindowWidthByRoom.get(prep.roomId) ?? null,
        radiatorWidthMm: minSized.radiatorWidthMm,
        widthCoverageRatio:
          minSized.widthCoverageRatio != null
            ? Math.round(minSized.widthCoverageRatio * 1000) / 1000
            : null,
        widthOk: minSized.widthOk,
        warnings: [],
        sizingNotes: [
          ...prep.mixedNotes,
          ...prep.microNotes,
          ...(minSized.sizingNotes ?? []),
        ],
        priceBasis: emitter.priceBasis,
        ...radiatorCommercialPriceFields(minSized.radiator),
        ...(minSized.panelLengthMm != null
          ? { panelLengthMm: minSized.panelLengthMm }
          : {}),
      });
      continue;
    }

    const sized = sizeForcedRoomEmitter({
      qRad: prep.qRad,
      forcedKind: resolvedKind,
      sectionalPool: sortedSectional,
      panelPoolFiltered,
      baseDeltaT,
      targetDeltaT: prep.roomTargetDeltaT,
      windowOpeningWidthMm: maxWindowWidthByRoom.get(prep.roomId) ?? null,
      openingHeightMm: maxWindowHeightByRoom.get(prep.roomId) ?? null,
      ventilationReserveFactor,
      emitterKindRules,
    });

    if (!sized) {
      byRoom.push(
        skippedRoomEmitter({
          roomId: prep.roomId,
          roomName: prep.roomName,
          designAirTempC: prep.roomInsideC,
          designAirTempSource: prep.airSource,
          heatLossWatts: prep.qEnvelope,
          radiatorDesignWatts: Math.round(prep.qRad),
          flowRateM3PerHour: radiatorFlowM3h(prep.qRad),
          radiatorModel: '—',
          warnings: [
            `Не удалось подобрать ${resolvedKind} радиатор из каталога (forced kind).`,
          ],
          sizingNotes: prep.mixedNotes,
        }),
      );
      continue;
    }

    if (sized.unitsCount > 1) anyMultiUnit = true;

    const emitter = emitterFieldsFromSized(
      sized.kind === 'panel' ? 'panel' : 'section',
      sized.adjustedWatts,
      sized.sections,
      sized.unitsCount,
    );

    /** @type {string[]} */
    const roomWarnings = [];
    if (sized.widthOk === false && prep.qEnvelope >= minRoomWattsForWindowWidthRule) {
      roomWarnings.push(
        `Радиатор перекрывает менее 70% ширины окна (${Math.round(
          (sized.widthCoverageRatio ?? 0) * 100,
        )}%). Рассмотрите другую длину/модель или перенос прибора.`,
      );
    }
    if (sized.underpowered) {
      underpoweredRoomIds.add(prep.roomId);
      roomWarnings.push(
        `В помещении «${prep.roomName}» секционный/панельный прибор типа «${resolvedKind}» `
          + `не покрывает 100% теплопотерь. Нехватка: ${sized.deficitWatts} Вт `
          + `(нагрузка ${Math.round(prep.qRad)} Вт, отдача ${emitter.deliverableWatts} Вт).`,
      );
    }

    byRoom.push({
      roomId: prep.roomId,
      roomName: prep.roomName,
      designAirTempC: prep.roomInsideC,
      designAirTempSource: prep.airSource,
      heatLossWatts: prep.qEnvelope,
      radiatorDesignWatts: Math.round(prep.qRad),
      flowRateM3PerHour: radiatorFlowM3h(prep.qRad),
      radiatorModel: sized.radiator.model,
      outputPerSectionWatts: emitter.outputPerSectionWatts,
      sections: sized.sections,
      sectionsThermalMin: sized.sectionsThermalMin ?? sized.sections,
      unitsCount: emitter.unitsCount,
      deliverableWatts: emitter.deliverableWatts,
      displayKind: emitter.displayKind,
      windowOpeningWidthMm: maxWindowWidthByRoom.get(prep.roomId) ?? null,
      radiatorWidthMm: sized.radiatorWidthMm,
      widthCoverageRatio:
        sized.widthCoverageRatio != null
          ? Math.round(sized.widthCoverageRatio * 1000) / 1000
          : null,
      widthOk: sized.widthOk,
      warnings: roomWarnings,
      sizingNotes: [...prep.mixedNotes, ...(sized.sizingNotes ?? [])],
      priceBasis: emitter.priceBasis,
      ...radiatorCommercialPriceFields(sized.radiator),
      ...(sized.panelLengthMm != null ? { panelLengthMm: sized.panelLengthMm } : {}),
    });
  }

  // Инвариант: один displayKind на все подобранные комнаты
  const kindsOnObject = new Set(
    byRoom
      .filter((r) => r.displayKind === 'sectional' || r.displayKind === 'panel')
      .map((r) => r.displayKind),
  );
  if (kindsOnObject.size > 1) {
    logger.error('matching.radiators.mixedKindsOnObject', null, {
      kinds: [...kindsOnObject],
      resolvedKind,
    });
  }

  const firstSized = byRoom.find((r) => r.radiatorModel && r.radiatorModel !== '—');
  const chosenRadiator =
    firstSized != null
      ? (allRadiators.find((r) => r.model === firstSized.radiatorModel) ?? null)
      : (sortedSectional[0] ?? panelPoolFiltered[0] ?? null);

  const chosen = chosenRadiator;
  const baseWatts = chosen
    ? baseDeltaT === 70
      ? chosen.outputWatts.deltaT70
      : chosen.outputWatts.deltaT50
    : 0;
  const adjustedWatts = chosen
    ? adjustOutputWatts({ baseWatts, baseDeltaT, targetDeltaT })
    : 0;
  const sectionWidthMm = chosen?.sectionWidthMm ?? chosen?.dimensions?.width ?? null;

  /** @type {string[]} */
  const warnings = [];

  const graphAutoAdjusted =
    heatingSystem
    && typeof heatingSystem === 'object'
    && /** @type {Record<string, unknown>} */ (heatingSystem)._thermalRegimeAutoAdjusted
      === true;

  if (
    radiatorLineTier == null
    && !graphAutoAdjusted
    && hasEfficientProposal
    && supplyC >= 65
    && returnC >= 55
  ) {
    warnings.push(
      'Для извлечения КПД конденсационного котла рекомендуется более низкий график теплоносителя '
        + '(например 55/45°C или тёплый пол) — при текущих supply/return расчёт радиаторов консервативен.',
    );
  }

  if (sectionWidthMm == null && maxWindowWidthByRoom.size > 0 && !panelPoolRaw.length) {
    warnings.push(
      'Невозможно проверить правило 70% ширины окна: у выбранного радиатора нет dimensions.width/sectionWidthMm.',
    );
  }
  if (sectionWidthMm != null && maxWindowWidthByRoom.size === 0) {
    warnings.push(
      'Невозможно проверить правило 70% ширины окна: в анкете не задано openingWidthMm для окон.',
    );
  }
  for (const item of byRoom) {
    for (const w of item.warnings ?? []) warnings.push(`[${item.roomName}] ${w}`);
  }

  /** @type {import('../../recommendations/types.js').ResolvedRecommendation[]} */
  const resolvedRecommendations = [];
  if (recommendations) {
    for (const code of microRecCodes) {
      const resolved = resolveRecommendation(recommendations, code);
      if (resolved) resolvedRecommendations.push(resolved);
    }
    if (decision.decisionSource === 'majority' || decision.decisionSource === 'tie_break') {
      const resolved = resolveRecommendation(
        recommendations,
        'REC_RADIATOR_EMITTER_KIND_MAJORITY',
        {
          resolvedEmitterKind: resolvedKind,
          sectionalVotes: decision.emitterKindVotes.sectional,
          panelVotes: decision.emitterKindVotes.panel,
          decisionSource: decision.decisionSource,
        },
      );
      if (resolved) resolvedRecommendations.push(resolved);
    }
    if (anyMultiUnit) {
      const resolved = resolveRecommendation(recommendations, 'REC_RADIATOR_MULTI_UNIT');
      if (resolved) resolvedRecommendations.push(resolved);
    }
    for (const row of byRoom) {
      if (!underpoweredRoomIds.has(row.roomId)) continue;
      const resolved = resolveRecommendation(
        recommendations,
        'WARN_RADIATOR_KIND_LOCKED_UNDERPOWERED',
        {
          roomName: row.roomName,
          resolvedEmitterKind: resolvedKind,
          deficitWatts: Math.max(
            0,
            Math.round((row.radiatorDesignWatts ?? 0) - (row.deliverableWatts ?? 0)),
          ),
          radiatorDesignWatts: Math.round(row.radiatorDesignWatts ?? 0),
          deliverableWatts: Math.round(row.deliverableWatts ?? 0),
        },
      );
      if (resolved) resolvedRecommendations.push(resolved);
    }
  }

  const emittersSummary = summarizeRadiatorEmitters(byRoom);

  return {
    chosen: chosen
      ? {
          model: chosen.model,
          ...(chosen.material != null ? { material: chosen.material } : {}),
          ...(chosen.volumeLiters != null
            ? { volumeLitersPerSection: chosen.volumeLiters }
            : {}),
          baseOutputWatts: baseWatts,
          baseDeltaT,
          adjustedOutputWatts: Math.round(adjustedWatts),
          targetDeltaT: round(targetDeltaT, 1),
          ...(sectionWidthMm != null ? { sectionWidthMm } : {}),
          ...(chosen.priceBasis != null ? { priceBasis: chosen.priceBasis } : {}),
        }
      : null,
    byRoom,
    emittersSummary,
    totalSections:
      emittersSummary.sectionalUnits > 0 || emittersSummary.panelUnits > 0
        ? emittersSummary.sectionalSections
        : null,
    warnings,
    inputs: {
      supplyC,
      returnC,
      insideC,
      baseDeltaT,
      targetDeltaT: round(targetDeltaT, 1),
      flowDeltaTK,
      ...(typeof deltaTSystemK === 'number' && deltaTSystemK > 0
        ? { deltaTSystemK }
        : {}),
      ventilationReserveFactor,
      radiatorSizingAlignedWithCondensing: hasEfficientProposal,
      heatingDistribution,
      ...(radiatorConnection != null ? { radiatorConnection } : {}),
      radiatorEmitterPreference,
      ...(heatingSystem.thermalRegimePreset != null
        ? { thermalRegimePreset: heatingSystem.thermalRegimePreset }
        : {}),
    },
    resolvedEmitterKind: resolvedKind,
    emitterKindVotes: decision.emitterKindVotes,
    emitterKindDecisionNotes: decision.emitterKindDecisionNotes,
    radiatorSelectionNotes,
    ...(resolvedRecommendations.length > 0 ? { resolvedRecommendations } : {}),
  };
}
