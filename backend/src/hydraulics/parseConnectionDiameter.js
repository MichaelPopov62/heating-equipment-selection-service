/**
 * Назначение: парсинг номинального диаметра из строк каталога котла.
 * Описание: «3/4 дюйма», «DN20», «20 мм» → мм для граничного условия pipeline.
 */

/** @type {Record<string, number>} */
const INCH_TO_MM = {
  '1/2': 15,
  '3/4': 20,
  '1': 25,
  '1 1/4': 32,
  '1 1/2': 40,
  '2': 50,
};

/**
 * @param {string} raw
 * @returns {number | null}
 */
export function parseConnectionDiameterMm(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw.trim().toLowerCase();

  const dnMatch = s.match(/\bdn\s*(\d{1,3})\b/i);
  if (dnMatch) {
    const n = Number(dnMatch[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const mmMatch = s.match(/(\d{1,3})\s*мм/);
  if (mmMatch) {
    const n = Number(mmMatch[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  for (const [inch, mm] of Object.entries(INCH_TO_MM)) {
    if (s.includes(`${inch} дюйм`) || s.includes(`${inch}"`)) {
      return mm;
    }
  }

  const bare = s.match(/\b(\d{1,2})\b/);
  if (bare) {
    const n = Number(bare[1]);
    if (n >= 10 && n <= 100) return n;
  }

  return null;
}

/**
 * @param {string[] | undefined | null} connectionDiameters
 * @returns {number[]}
 */
export function parseConnectionDiametersMm(connectionDiameters) {
  if (!Array.isArray(connectionDiameters)) return [];
  /** @type {number[]} */
  const out = [];
  for (const item of connectionDiameters) {
    const mm = parseConnectionDiameterMm(String(item));
    if (mm != null && !out.includes(mm)) out.push(mm);
  }
  return out;
}
