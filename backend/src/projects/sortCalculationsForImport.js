/**
 * Назначение: сортировка расчётов перед импортом (старые → новые).
 */

/**
 * @param {Array<{
 *   calcInput: unknown,
 *   report: unknown,
 *   summary?: unknown,
 *   sourceCreatedAt?: string,
 * }>} calculations
 * @returns {Array<{
 *   calcInput: unknown,
 *   report: unknown,
 *   summary?: unknown,
 *   sourceCreatedAt?: string,
 * }>}
 */
export function sortCalculationsForImport(calculations) {
  return [...calculations].sort((left, right) => {
    const leftTs = left.sourceCreatedAt ? Date.parse(left.sourceCreatedAt) : Number.NaN;
    const rightTs = right.sourceCreatedAt ? Date.parse(right.sourceCreatedAt) : Number.NaN;
    const leftKey = Number.isFinite(leftTs) ? leftTs : Number.MAX_SAFE_INTEGER;
    const rightKey = Number.isFinite(rightTs) ? rightTs : Number.MAX_SAFE_INTEGER;
    if (leftKey !== rightKey) return leftKey - rightKey;
    return 0;
  });
}
