/**
 * Назначение: Утилиты дедупликации и классификации предупреждений отчёта ТП.
 */

const LOOP_WARNING_RE = /^Петля\s+\S+:/u;
const ROOM_LOOP_WARNING_RE = /^Комната\s+«[^»]+»:\s*Петля\s+\S+:/u;
const LOW_VELOCITY_RE = /низкая скорость/iu;
/** Не использовать \\w — в JS без Unicode property escapes кириллица не входит в \\w. */
const PARASITIC_DOWN_RE = /паразитн[а-яёіїєґ]*\s+поток\s+вниз/iu;
const SURFACE_PRESET_OVERRIDE_RE =
  /пресет режима ТП ограничил максимальн[а-яёіїєґ]* температуру поверхности/iu;

export const UFH_WARN_LOW_VELOCITY_CODE = 'WARN_UFH_LOOP_LOW_VELOCITY_UNRESOLVED';
export const UFH_WARN_PARASITIC_DOWN_CODE = 'WARN_UFH_PARASITIC_DOWN_HEATED';
export const UFH_WARN_MIXING_NODE_CODE = 'WARN_UFH_MIXING_NODE_REQUIRED';
export const UFH_WARN_SURFACE_PRESET_OVERRIDE_CODE =
  'WARN_UFH_SURFACE_TEMP_PRESET_OVERRIDE';

/**
 * Предупреждение о низкой скорости в петле ТП (v &lt; 0.2 м/с).
 *
 * @param warning
 */
export function isUfhLowVelocityWarning(warning: string): boolean {
  return LOW_VELOCITY_RE.test(warning);
}

/**
 * Предупреждение о паразитном потоке вниз (прогрев перекрытия).
 *
 * @param warning
 */
export function isUfhParasiticDownWarning(warning: string): boolean {
  return PARASITIC_DOWN_RE.test(warning);
}

/**
 * Предупреждение о необходимости смесительного узла ТП.
 *
 * @param warning
 */
export function isUfhMixingNodeWarning(warning: string): boolean {
  return /насосно-смесительн|смесительн[а-яёіїєґ]*\s+узел/iu.test(warning);
}

/**
 * Пресет режима ТП ограничил Tповерх сильнее паспорта финиша.
 *
 * @param warning
 */
export function isUfhSurfacePresetOverrideWarning(warning: string): boolean {
  return SURFACE_PRESET_OVERRIDE_RE.test(warning);
}

/**
 * Убирает из списка комнаты строки, дублирующие warnings петель и агрегатные блоки.
 *
 * @param warnings
 */
export function filterRoomWarningsExcludingLoops(
  warnings: readonly string[],
): string[] {
  return warnings.filter(
    (w) =>
      !LOOP_WARNING_RE.test(w)
      && !ROOM_LOOP_WARNING_RE.test(w)
      && !isUfhParasiticDownWarning(w)
      && !isUfhSurfacePresetOverrideWarning(w),
  );
}

/**
 * Глобальный список без текстов structured recommendations и комнатных дублей.
 *
 * @param warnings
 * @param structuredTexts
 */
export function filterGlobalWarningsExcludingStructured(
  warnings: readonly string[],
  structuredTexts: ReadonlySet<string>,
): string[] {
  return warnings.filter((w) => {
    if (structuredTexts.has(w)) return false;
    if (LOOP_WARNING_RE.test(w) || ROOM_LOOP_WARNING_RE.test(w)) return false;
    if (/^Комната\s+«/u.test(w)) return false;
    if (isUfhLowVelocityWarning(w)) return false;
    if (isUfhParasiticDownWarning(w)) return false;
    if (isUfhMixingNodeWarning(w)) return false;
    if (isUfhSurfacePresetOverrideWarning(w)) return false;
    return true;
  });
}

/**
 * Собирает уникальные тексты WARN низкой скорости по всем петлям комнат.
 *
 * @param rooms
 */
export function collectLowVelocityLoopWarnings(
  rooms: readonly { loops?: readonly { warnings: readonly string[] }[] }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const room of rooms) {
    for (const loop of room.loops ?? []) {
      for (const w of loop.warnings) {
        if (!isUfhLowVelocityWarning(w) || seen.has(w)) continue;
        seen.add(w);
        out.push(w);
      }
    }
  }
  return out;
}

/**
 * Собирает уникальные тексты WARN паразитного потока вниз по комнатам.
 *
 * @param rooms
 */
export function collectParasiticDownWarnings(
  rooms: readonly { warnings: readonly string[] }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const room of rooms) {
    for (const w of room.warnings) {
      if (!isUfhParasiticDownWarning(w) || seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

/**
 * Собирает уникальные тексты WARN «пресет режима vs паспорт финиша».
 *
 * @param rooms
 */
export function collectSurfacePresetOverrideWarnings(
  rooms: readonly { warnings: readonly string[] }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const room of rooms) {
    for (const w of room.warnings) {
      if (!isUfhSurfacePresetOverrideWarning(w) || seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}
