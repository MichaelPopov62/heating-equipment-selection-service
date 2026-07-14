/**
 * Назначение: утилиты для verify-скриптов (noUncheckedIndexedAccess, guards).
 */

/**
 * @template T
 * @param {T | null | undefined} value
 * @param {string} [label]
 * @returns {T}
 */
export function assertDefined(value, label = 'value') {
  if (value === null || value === undefined) {
    throw new Error(`assertDefined: ${label} is null/undefined`);
  }
  return value;
}

/**
 * @template T
 * @param {readonly T[] | T[]} arr
 * @param {number} index
 * @param {string} [label]
 * @returns {T}
 */
export function assertAt(arr, index, label = 'array element') {
  const value = arr[index];
  return assertDefined(value, label);
}

/**
 * @typedef {Error & { code?: string }} ErrorWithCode
 */
