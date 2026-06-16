/**
 * Назначение: общие хелперы валидации справочников.
 * Описание: переиспользуемые проверки формы данных (числа, объекты, enum, строки) для
 * water_norms и appliances; пороги задаются в JSON/Mongo, не в коде.
 */
/** @param {unknown} v */
function posNum(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string} key
 * @param {string} path
 */
export function requirePosNum(obj, key, path) {
  const n = posNum(obj[key]);
  if (n == null) {
    throw new Error(`${path}.${key}: обязательное число > 0`);
  }
  return n;
}

/**
 * @param {Record<string, unknown>} parent
 * @param {string} key
 * @param {string} path
 */
export function requireObject(parent, key, path) {
  const v = parent[key];
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error(`${path}: ожидается объект`);
  }
  return /** @type {Record<string, unknown>} */ (v);
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string} key
 * @param {string} path
 */
export function requireFiniteNum(obj, key, path) {
  const n = Number(obj[key]);
  if (!Number.isFinite(n)) {
    throw new Error(`${path}.${key}: обязательное число`);
  }
  return n;
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string} key
 * @param {string} path
 */
export function requireNonEmptyString(obj, key, path) {
  const v = String(obj[key] ?? '').trim();
  if (!v) {
    throw new Error(`${path}.${key}: обязательная непустая строка`);
  }
  return v;
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string} key
 * @param {readonly string[]} allowed
 * @param {string} path
 */
export function requireEnum(obj, key, allowed, path) {
  const v = String(obj[key] ?? '').trim();
  if (!allowed.includes(v)) {
    throw new Error(`${path}.${key}: ожидается одно из [${allowed.join(', ')}]`);
  }
  return v;
}
