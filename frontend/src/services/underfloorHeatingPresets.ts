/**
 * Назначение: Сервис загрузки баз ТП и финишных покрытий.
 */

import { FALLBACK_FLOORING_FINISH_MATERIALS } from '../data/fallbackFlooringFinishes';
import { FALLBACK_UNDERFLOOR_HEATING_BASES } from '../data/fallbackUnderfloorHeatingPresets';
import type {
  FlooringFinishMaterial,
  UnderfloorHeatingBasePreset,
  UnderfloorHeatingPresetsBundle,
} from '../types/underfloorHeating';
function normalizeBases(arr: unknown[]): UnderfloorHeatingBasePreset[] {
  const out: UnderfloorHeatingBasePreset[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== 'string' || !rec.id.trim()) continue;
    if (typeof rec.name !== 'string' || !rec.name.trim()) continue;
    if (rec.usage !== 'underfloor_heating_base') continue;
    out.push(item as UnderfloorHeatingBasePreset);
  }
  return out;
}

function normalizeFinishes(arr: unknown[]): FlooringFinishMaterial[] {
  const out: FlooringFinishMaterial[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== 'string' || !rec.id.trim()) continue;
    if (typeof rec.name !== 'string' || !rec.name.trim()) continue;
    if (typeof rec.maxSurfaceTemperatureCelsius !== 'number') continue;
    out.push(item as FlooringFinishMaterial);
  }
  return out;
}

function mergeBases(api: UnderfloorHeatingBasePreset[]): UnderfloorHeatingBasePreset[] {
  const seen = new Set<string>();
  const merged: UnderfloorHeatingBasePreset[] = [];
  for (const p of api) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
  }
  for (const fb of FALLBACK_UNDERFLOOR_HEATING_BASES) {
    if (!seen.has(fb.id)) {
      seen.add(fb.id);
      merged.push(fb);
    }
  }
  return merged;
}

function mergeFinishes(api: FlooringFinishMaterial[]): FlooringFinishMaterial[] {
  const seen = new Set<string>();
  const merged: FlooringFinishMaterial[] = [];
  for (const m of api) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    merged.push(m);
  }
  for (const fb of FALLBACK_FLOORING_FINISH_MATERIALS) {
    if (!seen.has(fb.id)) {
      seen.add(fb.id);
      merged.push(fb);
    }
  }
  return merged;
}

/** Загружает bundle: bases + finishes (GET /api/v1/presets/underfloor-heating). */
export function fetchUnderfloorHeatingPresets(): Promise<UnderfloorHeatingPresetsBundle> {
  return loadUnderfloorHeatingPresetsFromApi();
}

/**
 * @returns {Promise<UnderfloorHeatingPresetsBundle>}
 */
async function loadUnderfloorHeatingPresetsFromApi(): Promise<UnderfloorHeatingPresetsBundle> {
  try {
    const res = await fetch('/api/v1/presets/underfloor-heating', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return {
        bases: [...FALLBACK_UNDERFLOOR_HEATING_BASES],
        finishes: [...FALLBACK_FLOORING_FINISH_MATERIALS],
      };
    }
    const data: unknown = await res.json();
    if (!data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) {
      return {
        bases: [...FALLBACK_UNDERFLOOR_HEATING_BASES],
        finishes: [...FALLBACK_FLOORING_FINISH_MATERIALS],
      };
    }
    const rec = data as { bases?: unknown; finishes?: unknown; presets?: unknown };
    const basesRaw = Array.isArray(rec.bases) ? rec.bases : [];
    const finishesRaw = Array.isArray(rec.finishes) ? rec.finishes : [];
    return {
      bases: mergeBases(normalizeBases(basesRaw)),
      finishes: mergeFinishes(normalizeFinishes(finishesRaw)),
    };
  } catch {
    return {
      bases: [...FALLBACK_UNDERFLOOR_HEATING_BASES],
      finishes: [...FALLBACK_FLOORING_FINISH_MATERIALS],
    };
  }
}
