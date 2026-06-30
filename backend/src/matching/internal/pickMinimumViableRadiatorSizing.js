/**
 * Назначение: минимальный жизнеспособный радиатор (1 секция / кратчайшая панель).
 * Описание: Для входных зон с малой расчётной нагрузкой — наименьший прибор из пула каталога.
 */

import {
  adjustedRadiatorWatts,
  filterPanelsByConnection,
  isPanelRadiator,
  isSectionalRadiator,
  parsePanelHeightMm,
  pickPanelSkuForRoom,
  underwindowHeightWarning,
} from '../radiatorSizingHelpers.js';

const SECTIONAL_CANDIDATES = 16;

/**
 * @param {object} args
 * @param {import('../../catalog/types').RadiatorCatalogItemNormalized[]} args.sectionalPool
 * @param {import('../../catalog/types').RadiatorCatalogItemNormalized[]} args.panelPoolFiltered
 * @param {50 | 70} args.baseDeltaT
 * @param {number} args.targetDeltaT
 * @param {'side' | 'bottom' | undefined} args.radiatorConnection
 * @param {number | null} [args.windowOpeningWidthMm]
 * @param {number | null} [args.openingHeightMm]
 * @returns {object | null}
 */
export function pickMinimumViableRadiatorSizing(args) {
  const {
    sectionalPool,
    panelPoolFiltered,
    baseDeltaT,
    targetDeltaT,
    radiatorConnection,
    windowOpeningWidthMm,
    openingHeightMm,
  } = args;

  /** @type {{ kind: 'section', radiator: import('../../catalog/types').RadiatorCatalogItemNormalized, adjustedWatts: number } | null} */
  let smallestSectional = null;
  for (const r of sectionalPool.slice(0, SECTIONAL_CANDIDATES)) {
    const adjustedWatts = adjustedRadiatorWatts(r, baseDeltaT, targetDeltaT);
    if (adjustedWatts <= 0) continue;
    if (!smallestSectional || adjustedWatts < smallestSectional.adjustedWatts) {
      smallestSectional = { kind: 'section', radiator: r, adjustedWatts };
    }
  }

  const panelPick =
    panelPoolFiltered.length > 0
      ? pickPanelSkuForRoom(1, panelPoolFiltered, baseDeltaT, targetDeltaT)
      : null;

  if (radiatorConnection === 'bottom' && panelPick) {
    const panelLengthMm = panelPick.panelLengthMm;
    const radiatorHeightMm =
      parsePanelHeightMm(panelPick.radiator.model)
      ?? panelPick.radiator.dimensions?.height
      ?? null;
    const hWarn = underwindowHeightWarning(openingHeightMm, radiatorHeightMm);
    /** @type {string[]} */
    const sizingNotes = [
      'Минимальный прибор: панель наименьшей длины из каталога (входная зона).',
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
    };
  }

  if (!smallestSectional) {
    if (panelPick) {
      const panelLengthMm = panelPick.panelLengthMm;
      return {
        kind: 'panel',
        radiator: panelPick.radiator,
        sections: null,
        sectionsThermalMin: null,
        adjustedWatts: panelPick.adjustedWatts,
        radiatorWidthMm: panelLengthMm,
        widthCoverageRatio: null,
        widthOk: null,
        sizingNotes: ['Минимальный прибор: панель из каталога (входная зона).'],
        panelLengthMm,
      };
    }
    return null;
  }

  const sectionWidthMm =
    smallestSectional.radiator.sectionWidthMm
    ?? smallestSectional.radiator.dimensions?.width
    ?? null;
  const sections = 1;
  const radiatorWidthMm =
    sectionWidthMm != null ? sections * sectionWidthMm : null;
  const radiatorHeightMm = smallestSectional.radiator.dimensions?.height ?? null;
  const hWarn = underwindowHeightWarning(openingHeightMm, radiatorHeightMm);

  /** @type {string[]} */
  const sizingNotes = [
    `Минимальный прибор: 1 секция ${smallestSectional.radiator.model} `
    + `(≈${Math.round(smallestSectional.adjustedWatts)} Вт при текущем графике).`,
  ];
  if (hWarn) sizingNotes.push(hWarn);

  return {
    kind: 'section',
    radiator: smallestSectional.radiator,
    sections,
    sectionsThermalMin: 1,
    adjustedWatts: smallestSectional.adjustedWatts,
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
  };
}

/**
 * @param {import('../../catalog/types').NormalizedCatalog} catalog
 * @param {'side' | 'bottom' | undefined} radiatorConnection
 * @returns {{
 *   sectionalPool: import('../../catalog/types').RadiatorCatalogItemNormalized[];
 *   panelPoolFiltered: import('../../catalog/types').RadiatorCatalogItemNormalized[];
 * }}
 */
export function buildRadiatorPoolsForSizing(catalog, radiatorConnection) {
  const allRadiators = catalog?.radiators ?? [];
  const sectionalPool = allRadiators.filter((r) => isSectionalRadiator(r));
  const panelPoolRaw = allRadiators.filter((r) => isPanelRadiator(r));
  const panelPoolFiltered = filterPanelsByConnection(panelPoolRaw, radiatorConnection);
  return { sectionalPool, panelPoolFiltered };
}
