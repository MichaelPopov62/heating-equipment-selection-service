/**
 * Назначение: минимальный жизнеспособный радиатор (1 секция / кратчайшая панель).
 * Описание: Обёртка над pickMinimumViableForcedKind; для скриптов без forced —
 * explore-голос bottom→panel сохранён только как fallback preference=auto на уровне объекта.
 */

import {
  pickMinimumViableForcedKind,
} from './sizeForcedRoomEmitter.js';
import {
  filterPanelsByConnection,
  isPanelRadiator,
  isSectionalRadiator,
} from '../radiatorSizingHelpers.js';

/**
 * @param {object} args
 * @param {import('../../catalog/types').RadiatorCatalogItemNormalized[]} args.sectionalPool
 * @param {import('../../catalog/types').RadiatorCatalogItemNormalized[]} args.panelPoolFiltered
 * @param {50 | 70} args.baseDeltaT
 * @param {number} args.targetDeltaT
 * @param {'side' | 'bottom' | undefined} args.radiatorConnection
 * @param {number | null} [args.windowOpeningWidthMm]
 * @param {number | null} [args.openingHeightMm]
 * @param {'sectional' | 'panel'} [args.forcedKind]
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
    forcedKind,
  } = args;

  /** @type {'sectional' | 'panel'} */
  let kind = forcedKind ?? 'sectional';
  if (forcedKind == null && radiatorConnection === 'bottom' && panelPoolFiltered.length > 0) {
    kind = 'panel';
  }

  return pickMinimumViableForcedKind({
    forcedKind: kind,
    sectionalPool,
    panelPoolFiltered,
    baseDeltaT,
    targetDeltaT,
    windowOpeningWidthMm,
    openingHeightMm,
  });
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
