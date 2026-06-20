/**
 * Назначение: математика теплопотерь через ограждения.
 * Описание: Q = U·S·ΔT с heatLossFactor и per-element ΔT. Резолвинг U — только в heatlossByRooms.js
 * (envelopePresets, wallAssembly). Экспортирует calculateHeatLoss(); вызывается из heatlossByRooms.js.
 */

/**
 * Перетворення в число з підтримкою “коми” в рядку.
 *
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {number}
 */
function toNumber(value, fieldName) {
  const n =
    typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(
      `Поле "${fieldName}" должно быть числом. Получено: ${String(value)}`,
    );
  }
  return n;
}

/**
 * Расчёт теплопотерь одного элемента ограждения.
 *
 * @param {import('../types/shared-types').HeatLossCalcElementInput} element
 * @param {number} defaultDeltaT - ΔT по умолчанию (K или °C)
 * @returns {import('../types/shared-types').HeatLossElementReport}
 */
function calculateElementLoss(element, defaultDeltaT) {
  if (!element || typeof element !== 'object') {
    throw new Error('Элемент ограждения должен быть объектом.');
  }

  const areaM2 = toNumber(element.areaM2, 'areaM2');
  if (areaM2 <= 0) {
    throw new Error(`Площадь areaM2 должна быть > 0. Получено: ${areaM2}`);
  }

  if (element.uValue == null) {
    throw new Error(
      'element.uValue обязателен. Резолвинг U — в heatlossByRooms (пресеты envelopePresets, wallAssembly).',
    );
  }
  const uValue = toNumber(element.uValue, 'uValue');

  // U = 0 допустим: «теплый пол» между жилыми этажами — теплопотери не считаем (см. пресеты пола).
  if (uValue < 0) {
    throw new Error(`U не может быть отрицательным. Получено: ${uValue}`);
  }

  const heatLossFactorRaw = element.heatLossFactor ?? 1;
  const heatLossFactor = toNumber(heatLossFactorRaw, 'heatLossFactor');
  if (heatLossFactor <= 0) {
    throw new Error(`heatLossFactor должен быть > 0. Получено: ${heatLossFactor}`);
  }

  const deltaT =
    element.deltaT != null
      ? toNumber(element.deltaT, 'deltaT')
      : toNumber(defaultDeltaT, 'deltaT');

  const baseQWatts = uValue * areaM2 * deltaT;
  const qWatts = baseQWatts * heatLossFactor;

  return {
    name: element.name ?? null,
    construction: element.construction ?? null,
    material: element.material ?? null,
    areaM2,
    uValue,
    deltaT,
    baseQWatts,
    heatLossFactor,
    qWatts,
    kind: element.kind ?? null,
    count: element.count ?? null,
    orientation: element.orientation ?? null,
    openingWidthMm: element.openingWidthMm ?? null,
    openingHeightMm: element.openingHeightMm ?? null,
    cornerRoomFactor: element.cornerRoomFactor ?? undefined,
    adjacentTempC: element.adjacentTempC ?? undefined,
  };
}

/**
 * Суммарные теплопотери по массиву элементов ограждения.
 *
 * @param {import('../types/shared-types').HeatLossCalcInput} input
 * @returns {import('../types/shared-types').HeatLossCalcResult}
 */
export function calculateHeatLoss(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Входные данные должны быть объектом.');
  }

  const insideTempC = toNumber(input.insideTempC, 'insideTempC');
  const outsideTempC = toNumber(input.outsideTempC, 'outsideTempC');
  const deltaT = insideTempC - outsideTempC;

  if (!Array.isArray(input.elements)) {
    throw new Error('Поле "elements" должно быть массивом.');
  }

  const elementLosses = input.elements.map((el) => calculateElementLoss(el, deltaT));
  const envelopeWatts = elementLosses.reduce((sum, x) => sum + x.qWatts, 0);

  // Резерв вентиляции (kVent) — в heatlossByRooms; здесь только ограждения.
  const ventilationWatts = 0;
  const ventilationMethod = null;
  const totalWatts = envelopeWatts;

  return {
    insideTempC,
    outsideTempC,
    deltaT,
    envelope: {
      watts: envelopeWatts,
      elements: elementLosses,
    },
    ventilation: {
      method: ventilationMethod,
      watts: ventilationWatts,
    },
    totalWatts,
  };
}
