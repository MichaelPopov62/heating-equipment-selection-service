/**
 * Назначение: Нормализация kind пресетов.
 * Описание: Приведение kind к каноническому виду и сортировка стен для отображения.
 */

import type { EnvelopePreset, EnvelopePresetKind } from '../types/envelope';

const KNOWN: ReadonlySet<string> = new Set(['wall', 'window', 'ceiling', 'floor', 'roof', 'insulation']);

/**
 * Сортировка пресетов стен для UI: по подписи материала (только несущий слой).
 */
export function sortWallPresetsForDisplay(presets: EnvelopePreset[]): EnvelopePreset[] {
  return [...presets].sort((a, b) => {
    const la = (a.material ?? a.construction ?? a.id).trim();
    const lb = (b.material ?? b.construction ?? b.id).trim();
    return la.localeCompare(lb, 'ru', { sensitivity: 'base' });
  });
}

/**
 * Нормализует kind пресета для фильтрации в UI.
 * Если поле kind отсутствует или нестандартно, пытаемся вывести его из id или construction.
 */
export function envelopePresetKindNormalized(p: Partial<EnvelopePreset> & { id?: string }): EnvelopePresetKind {
  const raw = String(p.kind ?? '')
    .trim()
    .toLowerCase();
  if (KNOWN.has(raw)) return raw as EnvelopePresetKind;

  const id = String(p.id ?? '').toLowerCase();
  if (id.startsWith('insul_')) return 'insulation';
  if (id.startsWith('window_')) return 'window';
  if (id.startsWith('wall_')) return 'wall';
  if (id.startsWith('floor_')) return 'floor';
  if (id.startsWith('ceiling_')) return 'ceiling';
  if (id.startsWith('roof_')) return 'roof';

  const c = String(p.construction ?? '').toLowerCase();
  if (c.includes('окно')) return 'window';
  if (c.includes('потолок')) return 'ceiling';
  if (c === 'пол' || c.startsWith('пол ')) return 'floor';
  if (c.includes('кровл') || c.includes('покрыт') || c.includes('мансард')) return 'roof';
  if (c.includes('стен')) return 'wall';

  if (id.includes('window')) return 'window';
  if (id.includes('floor')) return 'floor';
  if (id.includes('ceiling')) return 'ceiling';
  if (id.includes('roof')) return 'roof';
  if (id.includes('wall')) return 'wall';

  return 'wall';
}
