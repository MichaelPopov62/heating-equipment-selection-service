/**
 * Назначение: общие математические утилиты проекта.
 * Описание: Вспомогательные числовые функции, используемые в расчётном ядре и отчёте.
 */

/**
 * Округление до заданного количества знаков после запятой.
 * @param {number} n
 * @param {number} [digits=2]
 * @returns {number}
 */
export function round(n, digits = 2) {
  const k = 10 ** digits;
  return Math.round(n * k) / k;
}

