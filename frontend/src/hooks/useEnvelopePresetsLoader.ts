/**
 * Назначение: Хук загрузки пресетов ограждений.
 * Описание: Запрос GET /api/v1/presets/envelope и fallback при ошибке сети.
 */

import { useEffect, useState } from 'react';
import { FALLBACK_ENVELOPE_PRESETS } from '../data/fallbackEnvelopePresets';
import { fetchEnvelopePresets } from '../services/envelopePresets';
import type { EnvelopePreset } from '../types/envelope';

export function useEnvelopePresetsLoader() {
  const [envelopePresets, setEnvelopePresets] = useState<EnvelopePreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [presetsError, setPresetsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEnvelopePresets()
      .then((presets) => {
        if (cancelled) return;
        setEnvelopePresets(presets);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'Ошибка загрузки пресетов';
        setPresetsError(message);
        setEnvelopePresets([...FALLBACK_ENVELOPE_PRESETS]);
      })
      .finally(() => {
        if (cancelled) return;
        setPresetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { envelopePresets, presetsLoading, presetsError };
}
