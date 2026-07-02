/**
 * Назначение: Сервис загрузки пресетов ограждений.
 * Описание: Запрос API, нормализация и слияние с локальным fallback при сбое.
 */

import type { EnvelopePreset } from '../types/envelope';
import { FALLBACK_ENVELOPE_PRESETS } from '../data/fallbackEnvelopePresets';
import { envelopePresetKindNormalized } from '../utils/envelopePresetKind';
/** Нормализация элементов ответа API и восстановление kind, если поле отсутствует. */
function normalizePresetsList(arr: unknown[]): EnvelopePreset[] {
  const out: EnvelopePreset[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== 'string' || !rec.id.trim()) continue;
    const base = item as EnvelopePreset;
    const kind = envelopePresetKindNormalized(base);
    out.push({ ...base, kind });
  }
  return out;
}

/** Дополняет ответ API недостающими id из фолбэка (окна, пол, стены и т.д.). */
function mergeWithFallback(api: EnvelopePreset[]): EnvelopePreset[] {
  const seen = new Set<string>();
  const merged: EnvelopePreset[] = [];
  for (const p of api) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
  }
  for (const fb of FALLBACK_ENVELOPE_PRESETS) {
    if (!seen.has(fb.id)) {
      seen.add(fb.id);
      merged.push(fb);
    }
  }
  return merged;
}

/**
 * Загружает пресеты ограждений. При ошибке сети или неверном JSON возвращает встроенный фолбэк,
 * чтобы селекты стен/пола/окон не оставались пустыми.
 */
export function fetchEnvelopePresets(): Promise<EnvelopePreset[]> {
  return loadEnvelopePresetsFromApi();
}

/**
 * @returns {Promise<EnvelopePreset[]>}
 */
async function loadEnvelopePresetsFromApi(): Promise<EnvelopePreset[]> {
  try {
    const res = await fetch('/api/v1/presets/envelope', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return [...FALLBACK_ENVELOPE_PRESETS];
    }
    const data: unknown = await res.json();
    if (
      !data ||
      typeof data !== 'object' ||
      !('ok' in data) ||
      (data as { ok?: unknown }).ok !== true ||
      !('presets' in data) ||
      !Array.isArray((data as { presets?: unknown }).presets)
    ) {
      return [...FALLBACK_ENVELOPE_PRESETS];
    }
    const raw = (data as { presets: unknown[] }).presets;
    const normalized = normalizePresetsList(raw);
    return mergeWithFallback(normalized);
  } catch {
    return [...FALLBACK_ENVELOPE_PRESETS];
  }
}
