/**
 * Назначение: Pass 2 — подбор при forced kind с эскалацией.
 * Описание: без flip типа; высота/Вт → multi-unit → max + warning дефицита.
 */

import {
  adjustedRadiatorWatts,
  parsePanelHeightMm,
  pickPanelSkuForRoom,
  underwindowHeightWarning,
} from '../radiatorSizingHelpers.js';
import {
  applyWindowWidthRulesSectional,
  sortSectionalByEscalationPower,
} from './exploreRoomEmitterKind.js';

/**
 * @typedef {object} ForcedEmitterSized
 * @property {'section' | 'panel'} kind
 * @property {import('../../catalog/types').RadiatorCatalogItemNormalized} radiator
 * @property {number | null} sections
 * @property {number | null} sectionsThermalMin
 * @property {number} adjustedWatts
 * @property {number | null} radiatorWidthMm
 * @property {number | null} widthCoverageRatio
 * @property {boolean | null} widthOk
 * @property {string[]} sizingNotes
 * @property {number | null} panelLengthMm
 * @property {number} unitsCount
 * @property {boolean} underpowered
 * @property {number} deficitWatts
 */

/**
 * @param {object} args
 * @param {number} args.qRad
 * @param {'sectional' | 'panel'} args.forcedKind
 * @param {import('../../catalog/types').RadiatorCatalogItemNormalized[]} args.sectionalPool
 * @param {import('../../catalog/types').RadiatorCatalogItemNormalized[]} args.panelPoolFiltered
 * @param {50 | 70} args.baseDeltaT
 * @param {number} args.targetDeltaT
 * @param {number | null} [args.windowOpeningWidthMm]
 * @param {number | null} [args.openingHeightMm]
 * @param {number} args.ventilationReserveFactor
 * @param {import('../../dhw/types').RadiatorEmitterKindRules} args.emitterKindRules
 * @returns {ForcedEmitterSized | null}
 */
export function sizeForcedRoomEmitter(args) {
  const { forcedKind } = args;
  if (forcedKind === 'panel') {
    return sizeForcedPanel(args);
  }
  return sizeForcedSectional(args);
}

/**
 * @param {object} args
 * @returns {ForcedEmitterSized | null}
 */
function sizeForcedSectional(args) {
  const {
    qRad,
    sectionalPool,
    baseDeltaT,
    targetDeltaT,
    windowOpeningWidthMm,
    openingHeightMm,
    ventilationReserveFactor,
    emitterKindRules,
  } = args;

  if (!sectionalPool.length || qRad <= 0) return null;

  const {
    maxSectionsBeforeMultiUnit,
    maxUnitsPerRoom,
    maxSectionsHeuristic,
    sectionalCandidatesPerRoom,
  } = emitterKindRules;

  /** @type {ForcedEmitterSized | null} */
  let bestCovering = null;
  /** @type {ForcedEmitterSized | null} */
  let bestAny = null;

  const ranked = sortSectionalByEscalationPower(
    sectionalPool.slice(0, Math.max(sectionalCandidatesPerRoom * 2, 24)),
    baseDeltaT,
    targetDeltaT,
  );

  for (let unitsCount = 1; unitsCount <= maxUnitsPerRoom; unitsCount += 1) {
    const qPerUnit = qRad / unitsCount;
    for (const radiator of ranked) {
      const adjustedWatts = adjustedRadiatorWatts(radiator, baseDeltaT, targetDeltaT);
      if (adjustedWatts <= 0) continue;

      const sectionsThermalMin = Math.ceil(qPerUnit / adjustedWatts);
      const sectionWidthMm =
        radiator.sectionWidthMm ?? radiator.dimensions?.width ?? null;

      // Окно: доля ширины на один прибор при multi-unit
      const windowSlotMm =
        windowOpeningWidthMm != null && unitsCount > 1
          ? windowOpeningWidthMm / unitsCount
          : windowOpeningWidthMm;

      const win = applyWindowWidthRulesSectional({
        sections: sectionsThermalMin,
        sectionWidthMm,
        windowOpeningWidthMm: windowSlotMm ?? null,
        ventilationReserveFactor,
        maxSectionsHeuristic,
      });

      if (win.sections > maxSectionsHeuristic) continue;

      const deliverablePerUnit = adjustedWatts * win.sections;
      const deliverableTotal = deliverablePerUnit * unitsCount;
      const underpowered = deliverableTotal + 1e-6 < qRad;
      const deficitWatts = underpowered
        ? Math.max(0, Math.round(qRad - deliverableTotal))
        : 0;

      const radiatorHeightMm = radiator.dimensions?.height ?? null;
      const hWarn = underwindowHeightWarning(openingHeightMm ?? null, radiatorHeightMm);
      /** @type {string[]} */
      const sizingNotes = [...win.sizingNotes];
      if (unitsCount > 1) {
        sizingNotes.push(
          `Эскалация: ${unitsCount} секционных прибора(ов) в помещении `
            + `(нагрузка ≈${Math.round(qPerUnit)} Вт на прибор).`,
        );
      }
      if (windowOpeningWidthMm == null) {
        sizingNotes.push(
          'Глухая комната (нет оконного проёма) — правило ≥70% ширины окна не применяется.',
        );
      }
      if (hWarn) sizingNotes.push(hWarn);

      /** @type {ForcedEmitterSized} */
      const candidate = {
        kind: 'section',
        radiator,
        sections: win.sections,
        sectionsThermalMin,
        adjustedWatts,
        radiatorWidthMm:
          win.radiatorWidthMm != null ? win.radiatorWidthMm * unitsCount : null,
        widthCoverageRatio:
          windowOpeningWidthMm != null && win.radiatorWidthMm != null
            ? (win.radiatorWidthMm * unitsCount) / windowOpeningWidthMm
            : win.widthCoverageRatio,
        widthOk:
          windowOpeningWidthMm != null && win.radiatorWidthMm != null
            ? (win.radiatorWidthMm * unitsCount) / windowOpeningWidthMm >= 0.7
            : win.widthOk,
        sizingNotes,
        panelLengthMm: null,
        unitsCount,
        underpowered,
        deficitWatts,
      };

      if (!bestAny || scoreCandidate(candidate, qRad) > scoreCandidate(bestAny, qRad)) {
        bestAny = candidate;
      }

      const sectionsOk =
        win.sections <= maxSectionsBeforeMultiUnit
        || unitsCount > 1
        || !underpowered;
      if (!underpowered && sectionsOk) {
        if (
          !bestCovering
          || scoreCovering(candidate) > scoreCovering(bestCovering)
        ) {
          bestCovering = candidate;
        }
      }
    }

    // После unitsCount=1 без покрытия — пробуем multi-unit
    if (bestCovering && bestCovering.unitsCount === 1 && !bestCovering.underpowered) {
      break;
    }
  }

  const chosen = bestCovering ?? bestAny;
  if (!chosen) return null;

  if (chosen.underpowered) {
    chosen.sizingNotes.push(
      `Секционный радиатор не покрывает 100% теплопотерь при lock типа. `
        + `Нехватка: ${chosen.deficitWatts} Вт.`,
    );
  }

  return chosen;
}

/**
 * @param {object} args
 * @returns {ForcedEmitterSized | null}
 */
function sizeForcedPanel(args) {
  const {
    qRad,
    panelPoolFiltered,
    baseDeltaT,
    targetDeltaT,
    windowOpeningWidthMm,
    openingHeightMm,
    emitterKindRules,
  } = args;

  if (!panelPoolFiltered.length || qRad <= 0) return null;

  const { maxUnitsPerRoom } = emitterKindRules;

  /** @type {ForcedEmitterSized | null} */
  let bestCovering = null;
  /** @type {ForcedEmitterSized | null} */
  let bestAny = null;

  for (let unitsCount = 1; unitsCount <= maxUnitsPerRoom; unitsCount += 1) {
    const qPerUnit = qRad / unitsCount;
    const windowSlotMm =
      windowOpeningWidthMm != null && unitsCount > 1
        ? windowOpeningWidthMm / unitsCount
        : windowOpeningWidthMm;

    const panelPick = pickPanelSkuForRoom(
      qPerUnit,
      panelPoolFiltered,
      baseDeltaT,
      targetDeltaT,
      windowSlotMm ?? null,
    );
    if (!panelPick) continue;

    const panelLengthMm = panelPick.panelLengthMm;
    const radiatorHeightMm =
      parsePanelHeightMm(panelPick.radiator.model)
      ?? panelPick.radiator.dimensions?.height
      ?? null;
    const totalLength =
      panelLengthMm != null ? panelLengthMm * unitsCount : null;
    const widthCoverageRatio =
      windowOpeningWidthMm != null && totalLength != null
        ? totalLength / windowOpeningWidthMm
        : null;
    const widthOk =
      widthCoverageRatio != null ? widthCoverageRatio >= 0.7 : null;

    const deliverableTotal = panelPick.adjustedWatts * unitsCount;
    const underpowered = deliverableTotal + 1e-6 < qRad;
    const deficitWatts = underpowered
      ? Math.max(0, Math.round(qRad - deliverableTotal))
      : 0;

    /** @type {string[]} */
    const sizingNotes = [];
    if (unitsCount > 1) {
      sizingNotes.push(
        `Эскалация: ${unitsCount} панельных прибора(ов) в помещении `
          + `(нагрузка ≈${Math.round(qPerUnit)} Вт на прибор).`,
      );
    }
    if (windowOpeningWidthMm == null) {
      sizingNotes.push(
        'Глухая комната (нет оконного проёма) — правило ≥70% ширины окна не применяется.',
      );
    } else if (panelPick.windowLengthFilterApplied === false && widthOk === false) {
      sizingNotes.push(
        'Панель выбрана по тепловой мощности, но суммарно не закрывает ≥70% ширины окна.',
      );
    }
    if (panelPick.underpowered || underpowered) {
      sizingNotes.push(
        `Панельный радиатор не покрывает 100% теплопотерь при lock типа. `
          + `Нехватка: ${deficitWatts} Вт.`,
      );
    }
    const hWarn = underwindowHeightWarning(openingHeightMm ?? null, radiatorHeightMm);
    if (hWarn) sizingNotes.push(hWarn);

    /** @type {ForcedEmitterSized} */
    const candidate = {
      kind: 'panel',
      radiator: panelPick.radiator,
      sections: null,
      sectionsThermalMin: null,
      adjustedWatts: panelPick.adjustedWatts,
      radiatorWidthMm: totalLength,
      widthCoverageRatio,
      widthOk,
      sizingNotes,
      panelLengthMm,
      unitsCount,
      underpowered: underpowered || Boolean(panelPick.underpowered),
      deficitWatts,
    };

    if (!bestAny || scoreCandidate(candidate, qRad) > scoreCandidate(bestAny, qRad)) {
      bestAny = candidate;
    }
    if (!underpowered && !panelPick.underpowered) {
      if (!bestCovering || scoreCovering(candidate) > scoreCovering(bestCovering)) {
        bestCovering = candidate;
      }
      if (unitsCount === 1) break;
    }
  }

  return bestCovering ?? bestAny;
}

/**
 * @param {ForcedEmitterSized} c
 * @param {number} qRad
 */
function scoreCandidate(c, qRad) {
  const deliverable =
    c.kind === 'panel'
      ? c.adjustedWatts * c.unitsCount
      : c.adjustedWatts * (c.sections ?? 0) * c.unitsCount;
  const cover = Math.min(deliverable, qRad);
  const widthBonus = c.widthOk === true ? 50_000 : 0;
  const multiPenalty = (c.unitsCount - 1) * 100;
  return cover * 10 + widthBonus - multiPenalty - c.deficitWatts;
}

/**
 * @param {ForcedEmitterSized} c
 */
function scoreCovering(c) {
  const widthBonus = c.widthOk === true ? 1000 : 0;
  const multiPenalty = (c.unitsCount - 1) * 100;
  const sectionsPenalty =
    c.kind === 'section' && c.sections != null ? c.sections : 0;
  return widthBonus - multiPenalty - sectionsPenalty;
}

/**
 * Минимальный прибор при forced kind (входные зоны).
 * @param {object} args
 * @param {'sectional' | 'panel'} args.forcedKind
 * @param {import('../../catalog/types').RadiatorCatalogItemNormalized[]} args.sectionalPool
 * @param {import('../../catalog/types').RadiatorCatalogItemNormalized[]} args.panelPoolFiltered
 * @param {50 | 70} args.baseDeltaT
 * @param {number} args.targetDeltaT
 * @param {number | null} [args.windowOpeningWidthMm]
 * @param {number | null} [args.openingHeightMm]
 * @returns {ForcedEmitterSized | null}
 */
export function pickMinimumViableForcedKind(args) {
  const {
    forcedKind,
    sectionalPool,
    panelPoolFiltered,
    baseDeltaT,
    targetDeltaT,
    windowOpeningWidthMm,
    openingHeightMm,
  } = args;

  if (forcedKind === 'panel') {
    const panelPick =
      panelPoolFiltered.length > 0
        ? pickPanelSkuForRoom(
          1,
          panelPoolFiltered,
          baseDeltaT,
          targetDeltaT,
          windowOpeningWidthMm ?? null,
        )
        : null;
    if (!panelPick) return null;
    const panelLengthMm = panelPick.panelLengthMm;
    const radiatorHeightMm =
      parsePanelHeightMm(panelPick.radiator.model)
      ?? panelPick.radiator.dimensions?.height
      ?? null;
    const hWarn = underwindowHeightWarning(openingHeightMm ?? null, radiatorHeightMm);
    /** @type {string[]} */
    const sizingNotes = [
      'Минимальный прибор: панель наименьшей длины из каталога (входная зона, forced panel).',
    ];
    if (hWarn) sizingNotes.push(hWarn);
    return {
      kind: 'panel',
      radiator: panelPick.radiator,
      sections: null,
      sectionsThermalMin: null,
      adjustedWatts: panelPick.adjustedWatts,
      radiatorWidthMm: panelLengthMm,
      widthCoverageRatio:
        windowOpeningWidthMm != null && panelLengthMm != null
          ? panelLengthMm / windowOpeningWidthMm
          : null,
      widthOk:
        windowOpeningWidthMm != null && panelLengthMm != null
          ? panelLengthMm / windowOpeningWidthMm >= 0.7
          : null,
      sizingNotes,
      panelLengthMm,
      unitsCount: 1,
      underpowered: false,
      deficitWatts: 0,
    };
  }

  /** @type {{ radiator: import('../../catalog/types').RadiatorCatalogItemNormalized, adjustedWatts: number } | null} */
  let smallest = null;
  for (const r of sectionalPool.slice(0, 16)) {
    const adjustedWatts = adjustedRadiatorWatts(r, baseDeltaT, targetDeltaT);
    if (adjustedWatts <= 0) continue;
    if (!smallest || adjustedWatts < smallest.adjustedWatts) {
      smallest = { radiator: r, adjustedWatts };
    }
  }
  if (!smallest) return null;

  const sectionWidthMm =
    smallest.radiator.sectionWidthMm
    ?? smallest.radiator.dimensions?.width
    ?? null;
  const sections = 1;
  const radiatorWidthMm =
    sectionWidthMm != null ? sections * sectionWidthMm : null;
  const radiatorHeightMm = smallest.radiator.dimensions?.height ?? null;
  const hWarn = underwindowHeightWarning(openingHeightMm ?? null, radiatorHeightMm);
  /** @type {string[]} */
  const sizingNotes = [
    `Минимальный прибор: 1 секция ${smallest.radiator.model} `
      + `(≈${Math.round(smallest.adjustedWatts)} Вт; forced sectional).`,
  ];
  if (hWarn) sizingNotes.push(hWarn);

  return {
    kind: 'section',
    radiator: smallest.radiator,
    sections,
    sectionsThermalMin: 1,
    adjustedWatts: smallest.adjustedWatts,
    radiatorWidthMm,
    widthCoverageRatio:
      radiatorWidthMm != null && windowOpeningWidthMm != null
        ? radiatorWidthMm / windowOpeningWidthMm
        : null,
    widthOk:
      radiatorWidthMm != null && windowOpeningWidthMm != null
        ? radiatorWidthMm / windowOpeningWidthMm >= 0.7
        : null,
    sizingNotes,
    panelLengthMm: null,
    unitsCount: 1,
    underpowered: false,
    deficitWatts: 0,
  };
}
