/**
 * Назначение: Pass 1 — локальный «идеальный» kind комнаты (голос).
 * Описание: гейты окна / >N секций / bottom → только голос, не финальный подбор.
 */

import {
  adjustedRadiatorWatts,
  parsePanelHeightMm,
  pickPanelSkuForRoom,
} from '../radiatorSizingHelpers.js';

/**
 * @typedef {'sectional' | 'panel'} EmitterKind
 */

/**
 * @param {object} args
 * @param {number} args.qRad
 * @param {import('../../catalog/types').RadiatorCatalogItemNormalized[]} args.sectionalPool
 * @param {import('../../catalog/types').RadiatorCatalogItemNormalized[]} args.panelPoolFiltered
 * @param {50 | 70} args.baseDeltaT
 * @param {number} args.targetDeltaT
 * @param {'side' | 'bottom' | undefined} args.radiatorConnection
 * @param {number | null} [args.windowOpeningWidthMm]
 * @param {number} args.maxSectionsBeforeMultiUnit
 * @param {number} args.maxSectionsHeuristic
 * @param {number} args.sectionalCandidatesPerRoom
 * @param {number} args.ventilationReserveFactor
 * @returns {{ preferredKind: EmitterKind, reason: string } | null}
 */
export function exploreRoomEmitterKindVote(args) {
  const {
    qRad,
    sectionalPool,
    panelPoolFiltered,
    baseDeltaT,
    targetDeltaT,
    radiatorConnection,
    windowOpeningWidthMm,
    maxSectionsBeforeMultiUnit,
    maxSectionsHeuristic,
    sectionalCandidatesPerRoom,
    ventilationReserveFactor,
  } = args;

  if (qRad <= 0) return null;

  const sectionalThermal = sizeSectionalThermal(
    qRad,
    sectionalPool,
    baseDeltaT,
    targetDeltaT,
    sectionalCandidatesPerRoom,
  );
  const panelPick =
    panelPoolFiltered.length > 0
      ? pickPanelSkuForRoom(
        qRad,
        panelPoolFiltered,
        baseDeltaT,
        targetDeltaT,
        windowOpeningWidthMm ?? null,
      )
      : null;

  let sectionalWin = null;
  if (sectionalThermal) {
    const sectionWidthMm =
      sectionalThermal.radiator.sectionWidthMm
      ?? sectionalThermal.radiator.dimensions?.width
      ?? null;
    sectionalWin = applyWindowWidthRulesSectional({
      sections: sectionalThermal.sections,
      sectionWidthMm,
      windowOpeningWidthMm,
      ventilationReserveFactor,
      maxSectionsHeuristic,
    });
  }

  if (radiatorConnection === 'bottom' && panelPick) {
    return {
      preferredKind: 'panel',
      reason: 'Нижняя подводка: локально предпочтительна панель (голос Pass 1).',
    };
  }

  if (sectionalThermal && sectionalWin && panelPick) {
    const panelLen = panelPick.panelLengthMm;
    const panelWidthOk =
      windowOpeningWidthMm != null && panelLen != null
        ? panelLen / windowOpeningWidthMm >= 0.7
        : null;
    const secWidthOk = sectionalWin.widthOk;
    if (panelWidthOk === true && secWidthOk === false) {
      return {
        preferredKind: 'panel',
        reason:
          'Панель закрывает ≥70% ширины окна; секции после правила окна — нет (голос Pass 1).',
      };
    }
    if (
      sectionalWin.sections > maxSectionsBeforeMultiUnit
      && panelPick.adjustedWatts >= qRad
    ) {
      return {
        preferredKind: 'panel',
        reason:
          `Секционный вариант >${maxSectionsBeforeMultiUnit} секций `
          + `(${sectionalWin.sections}) — голос за панель.`,
      };
    }
  }

  if (!sectionalThermal && panelPick) {
    return {
      preferredKind: 'panel',
      reason: 'В пуле нет подходящих секций — голос за панель.',
    };
  }

  if (sectionalThermal) {
    return {
      preferredKind: 'sectional',
      reason: 'Локально предпочтительны секции (голос Pass 1).',
    };
  }

  if (panelPick) {
    return {
      preferredKind: 'panel',
      reason: 'Только панель доступна в каталоге (голос Pass 1).',
    };
  }

  return null;
}

/**
 * @param {number} qRad
 * @param {import('../../catalog/types').RadiatorCatalogItemNormalized[]} sectionalPool
 * @param {50 | 70} baseDeltaT
 * @param {number} targetDeltaT
 * @param {number} candidateLimit
 */
export function sizeSectionalThermal(
  qRad,
  sectionalPool,
  baseDeltaT,
  targetDeltaT,
  candidateLimit,
) {
  if (!sectionalPool.length || qRad <= 0) return null;
  const candidates = sectionalPool.slice(0, candidateLimit);
  /** @type {{ kind: 'section', radiator: import('../../catalog/types').RadiatorCatalogItemNormalized, sections: number, adjustedWatts: number, sectionsThermalMin: number } | null} */
  let best = null;
  for (const r of candidates) {
    const adjustedWatts = adjustedRadiatorWatts(r, baseDeltaT, targetDeltaT);
    if (adjustedWatts <= 0) continue;
    const sectionsThermalMin = Math.ceil(qRad / adjustedWatts);
    const isBetter =
      !best
      || sectionsThermalMin < best.sections
      || (sectionsThermalMin === best.sections && adjustedWatts < best.adjustedWatts);
    if (isBetter) {
      best = {
        kind: 'section',
        radiator: r,
        sections: sectionsThermalMin,
        adjustedWatts,
        sectionsThermalMin,
      };
    }
  }
  return best;
}

/**
 * @param {object} roomCtx
 */
export function applyWindowWidthRulesSectional(roomCtx) {
  const {
    sections: initialSections,
    sectionWidthMm,
    windowOpeningWidthMm,
    ventilationReserveFactor,
    maxSectionsHeuristic,
  } = roomCtx;
  let sections = initialSections;
  /** @type {string[]} */
  const sizingNotes = [];
  const minSectionsForWindow =
    windowOpeningWidthMm != null && sectionWidthMm != null && sectionWidthMm > 0
      ? Math.ceil((0.7 * windowOpeningWidthMm) / sectionWidthMm)
      : null;

  if (sections != null && minSectionsForWindow != null && sections < minSectionsForWindow) {
    const prev = sections;
    sections = Math.min(Math.max(minSectionsForWindow, prev), maxSectionsHeuristic);
    if (sections > prev) {
      sizingNotes.push(
        `Для правила ≥70% ширины окна число секций увеличено с ${prev} до ${sections} `
          + `(тепловая нагрузка с kVent=${ventilationReserveFactor} уже была покрыта меньшим числом).`,
      );
    }
  }

  let radiatorWidthMm =
    sections != null && sectionWidthMm != null ? sections * sectionWidthMm : null;
  let widthCoverageRatio =
    radiatorWidthMm != null && windowOpeningWidthMm != null
      ? radiatorWidthMm / windowOpeningWidthMm
      : null;
  let widthOk = widthCoverageRatio != null ? widthCoverageRatio >= 0.7 : null;

  if (
    sections != null
    && sectionWidthMm != null
    && windowOpeningWidthMm != null
    && widthOk === false
  ) {
    let s = sections;
    while (s < maxSectionsHeuristic && sectionWidthMm * s < 0.7 * windowOpeningWidthMm) {
      s += 1;
    }
    if (s > sections) {
      sizingNotes.push(
        `Дополнительно увеличено число секций до ${s} для подхода к покрытию ≥70% ширины окна.`,
      );
      sections = s;
      radiatorWidthMm = sections * sectionWidthMm;
      widthCoverageRatio = radiatorWidthMm / windowOpeningWidthMm;
      widthOk = widthCoverageRatio >= 0.7;
    }
  }

  return { sections, radiatorWidthMm, widthCoverageRatio, widthOk, sizingNotes };
}

/**
 * Сортировка секционного пула: выше/глубже (больше Вт/секцию) — для эскалации B.
 * @param {import('../../catalog/types').RadiatorCatalogItemNormalized[]} pool
 * @param {50 | 70} baseDeltaT
 * @param {number} targetDeltaT
 */
export function sortSectionalByEscalationPower(pool, baseDeltaT, targetDeltaT) {
  return [...pool].sort((a, b) => {
    const wa = adjustedRadiatorWatts(a, baseDeltaT, targetDeltaT);
    const wb = adjustedRadiatorWatts(b, baseDeltaT, targetDeltaT);
    if (wb !== wa) return wb - wa;
    const ha = a.dimensions?.height ?? 0;
    const hb = b.dimensions?.height ?? 0;
    return hb - ha;
  });
}

// re-export для эскалации (высота панели)
export { parsePanelHeightMm };
