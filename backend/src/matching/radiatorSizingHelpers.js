/**
 * Назначение: вспомогательные функции подбора радиаторов.
 * Описание: различение панельных и секционных моделей, парсинг габаритов, пересчёт паспортной
 * мощности секции под реальный график (adjustOutputWatts) и правила под окном.
 */
const MIN_UNDERWINDOW_CLEARANCE_MM = 100;

/**
 * @param {import('../catalog/types').RadiatorCatalogItemNormalized} r
 * @returns {boolean}
 */
export function isPanelRadiator(r) {
  return r?.priceBasis === 'panel';
}

/**
 * @param {import('../catalog/types').RadiatorCatalogItemNormalized} r
 * @returns {boolean}
 */
export function isSectionalRadiator(r) {
  return r?.priceBasis !== 'panel';
}

/**
 * Длина панели по строке модели «500x1000» / «500×1000» (мм).
 * @param {string | undefined} model
 * @returns {number | null}
 */
export function parsePanelLengthMm(model) {
  const m = String(model ?? '');
  const match = m.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
  if (!match) return null;
  const len = Number(match[2]);
  return Number.isFinite(len) && len > 0 ? len : null;
}

/**
 * Высота панели по строке модели (мм).
 * @param {string | undefined} model
 * @returns {number | null}
 */
export function parsePanelHeightMm(model) {
  const m = String(model ?? '');
  const match = m.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
  if (!match) return null;
  const h = Number(match[1]);
  return Number.isFinite(h) && h > 0 ? h : null;
}

/**
 * @param {import('../catalog/types').RadiatorCatalogItemNormalized} r
 * @returns {'side' | 'bottom' | null}
 */
export function inferPanelConnection(r) {
  const m = String(r?.model ?? '').toLowerCase();
  if (/\bvkp\b/i.test(m)) return 'bottom';
  if (/\b\d{2}k\b/i.test(m) || /klasik/i.test(m)) return 'side';
  return null;
}

/**
 * @param {import('../catalog/types').RadiatorCatalogItemNormalized[]} panelPool
 * @param {'side' | 'bottom' | undefined} radiatorConnection
 */
export function filterPanelsByConnection(panelPool, radiatorConnection) {
  if (!radiatorConnection) return [...panelPool];
  return panelPool.filter((p) => {
    const c = inferPanelConnection(p);
    if (c == null) return true;
    return c === radiatorConnection;
  });
}

/**
 * Перерахунок потужності до графіка (спільна формула для pickRadiatorsCore і verifyRadiatorSections).
 * @param {object} p
 * @param {number} p.baseWatts
 * @param {50 | 70} p.baseDeltaT
 * @param {number} p.targetDeltaT
 * @param {number} [p.exponent]
 * @returns {number}
 */
export function adjustOutputWatts({
  baseWatts,
  baseDeltaT,
  targetDeltaT,
  exponent = 1.3,
}) {
  if (targetDeltaT <= 0 || baseDeltaT <= 0) return 0;
  return baseWatts * (targetDeltaT / baseDeltaT) ** exponent;
}

/**
 * @param {import('../catalog/types').RadiatorCatalogItemNormalized} r
 * @param {50 | 70} baseDeltaT
 * @param {number} targetDeltaT
 */
export function adjustedRadiatorWatts(r, baseDeltaT, targetDeltaT) {
  const baseWatts =
    baseDeltaT === 70 ? r.outputWatts.deltaT70 : r.outputWatts.deltaT50;
  return adjustOutputWatts({ baseWatts, baseDeltaT, targetDeltaT });
}

/**
 * Минимальная панель из каталога (по длине), покрывающая нагрузку.
 *
 * @param {number} qRad
 * @param {import('../catalog/types').RadiatorCatalogItemNormalized[]} panelPool
 * @param {50 | 70} baseDeltaT
 * @param {number} targetDeltaT
 * @returns {{ radiator: import('../catalog/types').RadiatorCatalogItemNormalized, adjustedWatts: number, panelLengthMm: number } | null}
 */
export function pickPanelSkuForRoom(qRad, panelPool, baseDeltaT, targetDeltaT) {
  if (!panelPool.length || qRad <= 0) return null;

  const withLength = panelPool
    .map((r) => {
      const panelLengthMm = parsePanelLengthMm(r.model);
      const adjustedWatts = adjustedRadiatorWatts(r, baseDeltaT, targetDeltaT);
      return { r, panelLengthMm, adjustedWatts };
    })
    .filter((x) => x.panelLengthMm != null && x.adjustedWatts > 0)
    .sort((a, b) => a.panelLengthMm - b.panelLengthMm);

  const fit = withLength.find((x) => x.adjustedWatts >= qRad);
  if (fit) {
    return {
      radiator: fit.r,
      adjustedWatts: fit.adjustedWatts,
      panelLengthMm: fit.panelLengthMm,
    };
  }

  const largest = withLength[withLength.length - 1];
  if (!largest) return null;
  return {
    radiator: largest.r,
    adjustedWatts: largest.adjustedWatts,
    panelLengthMm: largest.panelLengthMm,
    underpowered: true,
  };
}

/**
 * Проверка зазора под подоконником (упрощённо: высота прибора vs высота окна).
 * @param {number | null} openingHeightMm
 * @param {number | null} radiatorHeightMm
 * @returns {string | null}
 */
export function underwindowHeightWarning(openingHeightMm, radiatorHeightMm) {
  if (
    openingHeightMm == null
    || radiatorHeightMm == null
    || !Number.isFinite(openingHeightMm)
    || !Number.isFinite(radiatorHeightMm)
  ) {
    return null;
  }
  const maxRadiatorH = openingHeightMm - 2 * MIN_UNDERWINDOW_CLEARANCE_MM;
  if (maxRadiatorH <= 0) return null;
  if (radiatorHeightMm <= maxRadiatorH) return null;
  return (
    `Высота прибора ${Math.round(radiatorHeightMm)} мм превышает допустимую под окном ` +
    `≈${Math.round(maxRadiatorH)} мм (зазор ${MIN_UNDERWINDOW_CLEARANCE_MM} мм снизу и сверху от высоты окна ` +
    `${Math.round(openingHeightMm)} мм).`
  );
}
