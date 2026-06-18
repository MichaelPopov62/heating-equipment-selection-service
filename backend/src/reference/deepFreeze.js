/**
 * Назначение: глубокая заморозка объектов справочников.
 * Описание: Используется в configCache при сборке ReferenceBundle — снимок общий между запросами.
 */

/**
 * Рекурсивно замораживает объект и вложенные plain-object / массивы.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function deepFreeze(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const key of Reflect.ownKeys(value)) {
    const child = /** @type {Record<string | symbol, unknown>} */ (value)[key];
    if (child && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }

  return value;
}
