/**
 * Назначение: фильтрация элементов ограждения по границам комнаты.
 * Описание: Определяет, учитывается ли элемент (стена, потолок, пол, кровля) в теплопотерях по topBoundary и bottomBoundary комнаты. Экспортирует envelopeKindIncludedForHeatLoss(); вызывается из heatlossByRooms.js перед расчётом Q.
 */

/**
 * @param {'heated' | 'unheated' | 'roof'} topBoundary
 * @param {'wall' | 'window' | 'ceiling' | 'floor' | 'roof' | null | undefined} kind
 * @returns {boolean} true — учитывать теплопотери через элемент
 */
function envelopeKindIncludedForTopBoundary(topBoundary, kind) {
  const k = kind ?? '';
  switch (topBoundary) {
    case 'heated':
      return k !== 'ceiling' && k !== 'roof';
    case 'unheated':
      return k !== 'roof';
    case 'roof':
      return k !== 'ceiling';
    default:
      return true;
  }
}

/**
 * @param {'heated' | 'unheated'} bottomBoundary
 * @param {'wall' | 'window' | 'ceiling' | 'floor' | 'roof' | null | undefined} kind
 * @returns {boolean}
 */
function envelopeKindIncludedForBottomBoundary(bottomBoundary, kind) {
  const k = kind ?? '';
  if (bottomBoundary === 'heated') {
    return k !== 'floor';
  }
  return true;
}

/**
 * @param {object} args
 * @param {'heated' | 'unheated' | 'roof'} args.topBoundary
 * @param {'heated' | 'unheated'} args.bottomBoundary
 * @param {'wall' | 'window' | 'ceiling' | 'floor' | 'roof' | null | undefined} args.kind
 * @returns {boolean}
 */
export function envelopeKindIncludedForHeatLoss({ topBoundary, bottomBoundary, kind }) {
  return (
    envelopeKindIncludedForTopBoundary(topBoundary, kind)
    && envelopeKindIncludedForBottomBoundary(bottomBoundary, kind)
  );
}
