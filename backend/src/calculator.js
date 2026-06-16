/**
 * Назначение: базовый расчёт теплопотерь помещения.
 * Описание: Считает потери через ограждающие конструкции (Q = U·S·ΔT) и вентиляцию (0,33·L·ΔT или 0,33·n·V·ΔT). Содержит запасной справочник U по текстовым ключам construction/material. Экспортирует calculateHeatLoss(); вызывается из logic/heatlossByRooms.js для детализации по комнатам.
 */

/**
 * Справочник средних коэффициентов теплопередачи U (Вт/м²·K).
 *
 * Запасной путь расчёта: если элемент ограждения приходит без `uValue`,
 * но с `construction` и `material`, совпадающими по ключу с этим словарём,
 * U подставится из таблицы. Основной путь для API — уже вычисленный `uValue`
 * из пресетов ограждений (`heatlossByRooms`).
 */
const U_VALUES = Object.freeze({
  // Наружные стены
  'наружная стена:газоблок 300 мм': 0.23,

  // Окна
  'окно:пвх с двойным стеклом': 1.3,

  // Потолок / перекрытие
  'потолок:бетон + утеплитель': 0.18,

  // Пол
  'пол:бетон без утепления': 0.6,
});

/**
 * Перетворення в число з підтримкою “коми” в рядку.
 * Використовується для більш дружнього прийому даних із форм/JSON.
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
 * Нормалізований ключ для довідника U: "конструкція:матеріал".
 */
function keyOf(construction, material) {
  const c = String(construction || '').trim().toLowerCase();
  const m = String(material || '').trim().toLowerCase();
  return `${c}:${m}`;
}

/**
 * Возвращает U по справочнику, если возможно.
 * Если в справочнике нет — возвращает null (тогда U нужно передать явно в элементе).
 */
function lookupU(construction, material) {
  const key = keyOf(construction, material);
  return Object.prototype.hasOwnProperty.call(U_VALUES, key) ? U_VALUES[key] : null;
}

/**
 * Расчёт теплопотерь одного элемента ограждения.
 *
 * @param {import('./types/shared-types').HeatLossCalcElementInput} element
 * @param {number} deltaT - ΔT (K или °C, разницы нет)
 * @returns {import('./types/shared-types').HeatLossElementReport}
 */
function calculateElementLoss(element, defaultDeltaT) {
  if (!element || typeof element !== 'object') {
    throw new Error('Элемент ограждения должен быть объектом.');
  }

  const areaM2 = toNumber(element.areaM2, 'areaM2');
  if (areaM2 <= 0) {
    throw new Error(`Площадь areaM2 должна быть > 0. Получено: ${areaM2}`);
  }

  const uFromDict = lookupU(element.construction, element.material);
  const uValue =
    element.uValue != null ? toNumber(element.uValue, 'uValue') : uFromDict;

  if (uValue == null) {
    const hint =
      element.construction || element.material
        ? `Не найден U для "${keyOf(
            element.construction,
            element.material,
          )}" — передайте element.uValue вручную.`
        : 'Не задан element.uValue и не указан construction/material для подстановки из справочника.';
    throw new Error(hint);
  }

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
 * Главная функция расчёта.
 *
 * @param {import('./types/shared-types').HeatLossCalcInput} input
 * @returns {import('./types/shared-types').HeatLossCalcResult}
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
