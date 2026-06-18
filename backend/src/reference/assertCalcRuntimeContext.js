/**
 * Назначение: fail-fast проверка CalcRuntimeContext на границе calc-пайплайна.
 * Описание: Дешёвая страховка в validate/buildReport; полная валидация — при загрузке справочников.
 */

/**
 * @param {unknown} ctx
 * @returns {asserts ctx is import('../types/shared-types').CalcRuntimeContext}
 */
export function assertCalcRuntimeContext(ctx) {
  if (!ctx || typeof ctx !== 'object') {
    throw new Error(
      'Критическая ошибка рантайма: CalcRuntimeContext отсутствует или не является объектом.',
    );
  }

  const c = /** @type {Record<string, unknown>} */ (ctx);

  if (!c.appliances || typeof c.appliances !== 'object') {
    throw new Error('CalcRuntimeContext: отсутствует appliances.');
  }
  if (!c.ufhPresets || typeof c.ufhPresets !== 'object') {
    throw new Error('CalcRuntimeContext: отсутствует ufhPresets.');
  }
  if (!c.waterNorms || typeof c.waterNorms !== 'object') {
    throw new Error('CalcRuntimeContext: отсутствует waterNorms.');
  }
  if (!c.catalog || typeof c.catalog !== 'object') {
    throw new Error('CalcRuntimeContext: отсутствует catalog.');
  }
  if (!c.recommendations || typeof c.recommendations !== 'object') {
    throw new Error('CalcRuntimeContext: отсутствует recommendations.');
  }
  if (!c.sources || typeof c.sources !== 'object') {
    throw new Error('CalcRuntimeContext: отсутствует sources.');
  }

  const ufh = /** @type {{ byPresetId?: unknown }} */ (c.ufhPresets);
  const app = /** @type {{ byKind?: unknown }} */ (c.appliances);
  if (!ufh.byPresetId || typeof ufh.byPresetId !== 'object') {
    throw new Error('CalcRuntimeContext: ufhPresets.byPresetId обязателен.');
  }
  if (!app.byKind || typeof app.byKind !== 'object') {
    throw new Error('CalcRuntimeContext: appliances.byKind обязателен.');
  }
}
