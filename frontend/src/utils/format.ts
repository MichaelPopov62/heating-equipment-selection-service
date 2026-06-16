/**
 * Назначение: Форматирование чисел для UI.
 * Описание: Киловатты, цены UAH, литры и строка «бренд · модель».
 */

/** Киловатты: `"12.34"` (по умолчанию 2 знака). */
export function formatKw(value: number, fractionDigits = 2): string {
  return value.toFixed(fractionDigits);
}

/** Цена в гривнах: `"12 345"` (локаль uk-UA, без суффикса «грн»). */
export function formatPriceUah(value: number): string {
  return value.toLocaleString('uk-UA', { maximumFractionDigits: 0 });
}

/** Литры: целое число. */
export function formatLiters(value: number): string {
  return String(Math.round(value));
}

/** Площадь, м²: 1 знак после запятой. */
export function formatAreaM2(value: number): string {
  return value.toFixed(1);
}

/** Расход, л/с: 3 знака после запятой. */
export function formatFlowLps(value: number): string {
  return value.toFixed(3);
}

/** Коэффициент / множитель: 2 знака (одновременность, запас ×1.15). */
export function formatCoefficient(value: number): string {
  return value.toFixed(2);
}

/** Процент: по умолчанию 1 знак после запятой. */
export function formatPercent(value: number, fractionDigits = 1): string {
  return value.toFixed(fractionDigits);
}

/** Температура, °C: по умолчанию 1 знак после запятой. */
export function formatTempC(value: number, fractionDigits = 1): string {
  return value.toFixed(fractionDigits);
}

/** Тепловой поток, Вт/м²: целое число. */
export function formatHeatFluxWm2(value: number): string {
  return String(Math.round(value));
}

/** Мощность / тепловой поток, Вт: целое число. */
export function formatWatts(value: number): string {
  return String(Math.round(value));
}

/** Модель с брендом или без. */
export function formatBrandModel(brand: string | null | undefined, model: string): string {
  return brand ? `${brand} · ${model}` : model;
}
