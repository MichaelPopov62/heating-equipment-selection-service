import {
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from '../../shared/heatingMatchingSchemes.js';
import type {
  CalcRequestBody,
  EnvelopeElementInput,
  RoomInput,
  RoomType,
} from '../src/types/shared-types.js';

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const SERVER_URL = 'http://localhost:3001/api/v1/calc';
const FUZZ_INTER_REQUEST_MS = 120;
const FUZZ_MAX_429_RETRIES = 8;

/**
 * HTTP-помилка відповіді calc (fetch).
 */
class CalcHttpError extends Error {
  readonly status: number;
  readonly data: unknown;
  readonly headers: Headers;

  /**
   * @param status — HTTP status
   * @param data — тіло JSON або text
   * @param headers — заголовки відповіді
   */
  constructor(status: number, data: unknown, headers: Headers) {
    super(`HTTP ${status}`);
    this.name = 'CalcHttpError';
    this.status = status;
    this.data = data;
    this.headers = headers;
  }
}

/**
 * Затримка перед повтором після 429 (Retry-After або RateLimit-Reset).
 * @param headers — заголовки відповіді Express rate-limit
 */
function parseRetryAfterMs(headers: Headers): number {
  const retryAfter = headers.get('retry-after');
  if (retryAfter != null) {
    const sec = Number(retryAfter);
    if (Number.isFinite(sec) && sec > 0) return sec * 1000;
  }

  const reset = headers.get('ratelimit-reset');
  if (reset != null) {
    const resetSec = Number(reset);
    if (Number.isFinite(resetSec)) {
      const waitMs = resetSec * 1000 - Date.now();
      if (waitMs > 0) return Math.min(waitMs + 500, 15 * 60 * 1000);
    }
  }

  return 5000;
}

/**
 * Читає тіло відповіді як JSON, інакше текст.
 * @param response — fetch Response
 */
async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * POST /calc з повтором при 429 (rate limit API).
 * @param payload — тіло calc-запиту
 */
async function postCalcWithRetry(
  payload: CalcRequestBody,
): Promise<{ data: unknown; remaining: number | null }> {
  for (let attempt = 0; attempt <= FUZZ_MAX_429_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error: unknown) {
      throw error;
    }

    const data = await readResponseBody(response);
    if (response.ok) {
      const remainingRaw = response.headers.get('ratelimit-remaining');
      const remaining = remainingRaw != null ? Number(remainingRaw) : NaN;
      return {
        data,
        remaining: Number.isFinite(remaining) ? remaining : null,
      };
    }

    if (response.status === 429 && attempt < FUZZ_MAX_429_RETRIES) {
      const waitMs = parseRetryAfterMs(response.headers);
      console.warn(
        `⏳ Rate limit (429), пауза ${Math.ceil(waitMs / 1000)} с (спроба ${attempt + 1}/${FUZZ_MAX_429_RETRIES})…`,
      );
      await delay(waitMs);
      continue;
    }

    throw new CalcHttpError(response.status, data, response.headers);
  }

  throw new Error('postCalcWithRetry: unreachable');
}

const WALL_PRESET_ID = 'wall_gas_concrete_d500';
const WINDOW_PRESET_ID = 'window_pvc_double_chamber_3_glass';
const UFH_BASE_PRESET_ID = 'ufh_base_interstory_screed_65';

const APARTMENT_ROOM_TYPES = [
  'гостиная',
  'кухня',
  'спальня',
  'санузел',
  'коридор',
] as const satisfies readonly RoomType[];

const HOUSE_ROOM_TYPES = [
  'гостиная',
  'кухня',
  'спальня',
  'санузел',
  'прихожая',
] as const satisfies readonly RoomType[];

const FINISH_MATERIALS = [
  'ceramic_tile',
  'pvc_glue',
  'pvc_click',
  'laminate_click',
] as const;

const ORIENTATIONS = ['N', 'NE', 'E', 'SE', 'SW', 'NW'] as const;
const PIPE_SPACINGS = [100, 150, 200] as const;

const HOUSE_BOILER_SCHEMES = [
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
  SCHEME_BOILER_ELECTRIC_SEPARATE,
] as const;

type FuzzProfile = 'apartment_mixed_ufh' | 'house_radiators_ufh';

/** Випадкове число в діапазоні [min, max] з округленням. */
const randomIn = (min: number, max: number, round = 1): number => {
  const factor = 10 ** round;
  return Math.round((Math.random() * (max - min) + min) * factor) / factor;
};

/** Випадковий елемент масиву. */
const pickRandom = <T>(arr: readonly T[]): T => {
  const item = arr[Math.floor(Math.random() * arr.length)];
  if (item === undefined) {
    throw new Error('pickRandom: empty array');
  }
  return item;
};

/** Площа вікна з розмірів проєму, м². */
const windowAreaM2 = (widthMm: number, heightMm: number): number =>
  Math.round(((widthMm * heightMm) / 1_000_000) * 100) / 100;

/** Фасадна стіна + вікно (як у verifyHydraulicsPipeline → mixed_radiators_ufh). */
function buildFacadeEnvelope(
  roomId: string,
  orientation: (typeof ORIENTATIONS)[number],
): EnvelopeElementInput[] {
  const openingWidthMm = randomIn(1200, 1800, 0);
  const openingHeightMm = randomIn(1200, 1500, 0);

  return [
    {
      kind: 'wall',
      roomId,
      construction: 'наружная стена',
      presetId: WALL_PRESET_ID,
      areaM2: randomIn(6, 14, 1),
      orientation,
    },
    {
      kind: 'window',
      roomId,
      construction: 'окно',
      presetId: WINDOW_PRESET_ID,
      areaM2: windowAreaM2(openingWidthMm, openingHeightMm),
      orientation,
      openingWidthMm,
      openingHeightMm,
    },
  ];
}

/** Квартира МКД: mixed радіатори + ТП (еталон mixed_radiators_ufh). */
function generateApartmentMixedInput(): CalcRequestBody {
  const roomsCount = randomIn(2, 5, 0);
  const kitchenIndex = randomIn(1, roomsCount, 0);
  const rooms: RoomInput[] = [];
  const envelopeElements: EnvelopeElementInput[] = [];

  for (let i = 1; i <= roomsCount; i++) {
    const roomId = `r${i}`;
    const areaM2 = randomIn(10, 24, 1);
    const isKitchen = i === kitchenIndex;
    const type: RoomType = isKitchen
      ? 'кухня'
      : pickRandom(APARTMENT_ROOM_TYPES.filter((t) => t !== 'кухня'));
    const orientation = pickRandom(ORIENTATIONS);

    const room: RoomInput = {
      id: roomId,
      name: isKitchen ? 'Кухня' : `Кімната ${i}`,
      type,
      floor: 1,
      topBoundary: 'heated',
      bottomBoundary: 'heated',
      areaM2,
      heightM: randomIn(2.5, 2.8, 2),
      roomExteriorLayout: 'facade',
      ...(isKitchen || (type === 'санузел' && Math.random() > 0.5)
        ? {
            underfloorHeating: {
              enabled: true,
              basePresetId: UFH_BASE_PRESET_ID,
              finishMaterialId: pickRandom(FINISH_MATERIALS),
              pipeSpacingMm: pickRandom(PIPE_SPACINGS),
            },
          }
        : {}),
    };
    rooms.push(room);

    envelopeElements.push(
      ...buildFacadeEnvelope(roomId, orientation),
      {
        kind: 'floor',
        roomId,
        construction: 'пол',
        presetId: 'floor_interstory_apartment',
        areaM2,
      },
    );
  }

  return {
    building: {
      temps: {
        insideC: pickRandom([18, 20, 22] as const),
        outsideC: pickRandom([-15, -20, -22, -26] as const),
      },
      objectMeta: {
        objectType: 'apartment',
        apartmentStackPosition: 'middle_floor',
        floors: 1,
        roomsCount,
        ventilationReserveMode: 'natural',
        externalWalls: {
          presetId: WALL_PRESET_ID,
          thicknessMm: 375,
          facadeSystem: 'none',
        },
      },
      rooms,
      envelopeElements,
    },
    heatingSystem: {
      supplyC: 75,
      returnC: 65,
      insideC: 20,
      thermalRegimePreset: 'traditional_dt50_75_65',
      waterUnderfloorHeating: true,
      ufhPresetId: 'ufh_mixed_radiators',
      hotWaterBoilerPowerMatchingScheme: SCHEME_BOILER_MAX_COMBI,
    },
    hotWater: {
      residents: randomIn(1, 4, 0),
      coldWaterDesignSeason: 'winter',
      hotWaterC: 60,
      tropicalShower: false,
      fixtures: {
        shower: randomIn(1, 2, 0),
        sink: randomIn(1, 2, 0),
        kitchenSink: 1,
        bath: randomIn(0, 1, 0),
        toilet: randomIn(1, 2, 0),
      },
    },
    hydraulics: {
      mainLineLengthM: randomIn(4, 20, 0),
      deltaTSystemK: 20,
    },
  };
}

/** Приватний будинок: радіатори + опційно ТП (еталон baseBuilding / minimalBody). */
function generateHouseInput(): CalcRequestBody {
  const floors = pickRandom([1, 2] as const);
  const roomsCount = randomIn(1, 4, 0);
  const rooms: RoomInput[] = [];
  const envelopeElements: EnvelopeElementInput[] = [];

  for (let i = 1; i <= roomsCount; i++) {
    const roomId = `r${i}`;
    const areaM2 = randomIn(10, 30, 1);
    const floor = (i === 1 ? 1 : pickRandom([1, 2] as const)) as 1 | 2;
    const type = pickRandom(HOUSE_ROOM_TYPES);
    const orientation = pickRandom(ORIENTATIONS);
    const enableUfh =
      type === 'кухня' || type === 'санузел' || Math.random() > 0.65;

    const room: RoomInput = {
      id: roomId,
      name: `Кімната ${i}`,
      type,
      floor,
      topBoundary: floor === floors && Math.random() > 0.85 ? 'roof' : 'heated',
      bottomBoundary: floor === 1 ? 'unheated' : 'heated',
      areaM2,
      heightM: randomIn(2.6, 3.0, 2),
      roomExteriorLayout: 'facade',
      ...(enableUfh
        ? {
            underfloorHeating: {
              enabled: true,
              basePresetId: UFH_BASE_PRESET_ID,
              finishMaterialId: pickRandom(FINISH_MATERIALS),
              pipeSpacingMm: pickRandom(PIPE_SPACINGS),
            },
          }
        : {}),
    };
    rooms.push(room);

    envelopeElements.push(...buildFacadeEnvelope(roomId, orientation));

    if (room.bottomBoundary === 'unheated') {
      envelopeElements.push({
        kind: 'floor',
        roomId,
        construction: 'пол',
        presetId: pickRandom([
          'floor_concrete_uninsulated',
          'floor_ground_eps_100',
        ] as const),
        areaM2,
      });
    }
  }

  const hasUfh = rooms.some((r) => r.underfloorHeating?.enabled);

  return {
    building: {
      temps: {
        insideC: pickRandom([18, 20, 22] as const),
        outsideC: pickRandom([-15, -20, -24, -28] as const),
      },
      objectMeta: {
        objectType: 'house',
        floors,
        roomsCount,
        ventilationReserveMode: 'natural',
        boilerPlacementZone: 'kitchen',
        externalWalls: {
          presetId: WALL_PRESET_ID,
          thicknessMm: 375,
          facadeSystem: 'none',
        },
      },
      rooms,
      envelopeElements,
    },
    heatingSystem: {
      supplyC: 75,
      returnC: 65,
      insideC: 20,
      thermalRegimePreset: 'traditional_dt50_75_65',
      ...(hasUfh
        ? {
            waterUnderfloorHeating: true,
            ufhPresetId: 'ufh_mixed_radiators' as const,
          }
        : {}),
      hotWaterBoilerPowerMatchingScheme: pickRandom(HOUSE_BOILER_SCHEMES),
    },
    hotWater: {
      residents: randomIn(2, 5, 0),
      coldWaterDesignSeason: 'winter',
      hotWaterC: 60,
      tropicalShower: Math.random() > 0.5,
      fixtures: {
        shower: randomIn(1, 2, 0),
        sink: randomIn(1, 3, 0),
        kitchenSink: 1,
        bath: randomIn(0, 1, 0),
        toilet: randomIn(1, 2, 0),
      },
    },
    hydraulics: {
      mainLineLengthM: randomIn(6, 30, 0),
      deltaTSystemK: 20,
    },
  };
}

/** Випадковий профіль fuzz: квартира або будинок. */
function generateRandomInput(): { profile: FuzzProfile; payload: CalcRequestBody } {
  const useApartment = Math.random() > 0.5;
  return useApartment
    ? { profile: 'apartment_mixed_ufh', payload: generateApartmentMixedInput() }
    : { profile: 'house_radiators_ufh', payload: generateHouseInput() };
}

interface FuzzStats {
  successful: number;
  withWarnings: number;
  validationFailed: number;
  rateLimited: number;
  serverCrashed: number;
}

interface CalcErrorDetail {
  message?: string;
  code?: string;
}

/** Чи це plain-object для звуження unknown. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Попередження ТП з тіла calc-звіту. */
function readUfhWarnings(data: unknown): string[] {
  if (!isRecord(data) || !isRecord(data.calculations)) return [];
  const underfloor = data.calculations.underfloorHeating;
  if (!isRecord(underfloor) || !Array.isArray(underfloor.rooms)) return [];
  const out: string[] = [];
  for (const room of underfloor.rooms) {
    if (!isRecord(room) || !Array.isArray(room.warnings)) continue;
    for (const w of room.warnings) {
      if (typeof w === 'string') out.push(w);
    }
  }
  return out;
}

/** Нотатки гідравліки з тіла calc-звіту. */
function readHydraulicNotes(data: unknown): string[] {
  if (!isRecord(data) || !isRecord(data.calculations)) return [];
  const hydraulics = data.calculations.hydraulics;
  if (!isRecord(hydraulics) || !Array.isArray(hydraulics.notes)) return [];
  return hydraulics.notes.filter((n): n is string => typeof n === 'string');
}

/** Деталі валідації з error envelope. */
function parseCalcErrorDetails(data: unknown): CalcErrorDetail[] {
  if (!isRecord(data)) return [];
  const errNode = data.error;
  if (!isRecord(errNode) || !Array.isArray(errNode.details)) return [];
  const out: CalcErrorDetail[] = [];
  for (const item of errNode.details) {
    if (!isRecord(item)) continue;
    out.push({
      ...(typeof item.message === 'string' ? { message: item.message } : {}),
      ...(typeof item.code === 'string' ? { code: item.code } : {}),
    });
  }
  return out;
}

/** Головний раннер фаззінг-тесту calc API. */
async function runFuzzTests(iterations = 50): Promise<void> {
  const stats: FuzzStats = {
    successful: 0,
    withWarnings: 0,
    validationFailed: 0,
    rateLimited: 0,
    serverCrashed: 0,
  };

  const profileCounts: Record<FuzzProfile, number> = {
    apartment_mixed_ufh: 0,
    house_radiators_ufh: 0,
  };

  const deadlockScenarios: Array<{
    iteration: number;
    profile: FuzzProfile;
    warnings: string[];
  }> = [];

  console.log(`Fuzz calc: ${iterations} iterations...\n`);

  for (let i = 1; i <= iterations; i++) {
    const { profile, payload } = generateRandomInput();
    profileCounts[profile] += 1;

    try {
      const { data, remaining } = await postCalcWithRetry(payload);
      const ufhWarnings = readUfhWarnings(data);
      const hydraulicNotes = readHydraulicNotes(data);

      const hasUnresolvedConflict = ufhWarnings.some(
        (w) => w.includes('низкая скорость') || w.includes('высокий риск'),
      );

      if (hasUnresolvedConflict) {
        deadlockScenarios.push({
          iteration: i,
          profile,
          warnings: ufhWarnings,
        });
        stats.withWarnings += 1;
      } else if (ufhWarnings.length > 0 || hydraulicNotes.length > 0) {
        stats.withWarnings += 1;
      } else {
        stats.successful += 1;
      }

      if (remaining !== null && remaining <= 2) {
        await delay(2000);
      }
    } catch (error: unknown) {
      if (error instanceof CalcHttpError) {
        const status = error.status;
        const details = parseCalcErrorDetails(error.data);

        if (status === 400) {
          stats.validationFailed += 1;
          if (stats.validationFailed <= 3) {
            console.error(
              `⚠️ Ітерація №${i} [${profile}]: HTTP 400 (валідація)`,
            );
            if (details.length > 0) {
              const first = details[0];
              console.error(
                `   ${first?.code ?? ''}: ${first?.message ?? ''}`,
              );
            }
          }
        } else if (status === 429) {
          stats.rateLimited += 1;
          if (stats.rateLimited <= 3) {
            console.error(
              `❌ Ітерація №${i} [${profile}]: HTTP 429 (rate limit після повторів)`,
            );
          }
        } else {
          stats.serverCrashed += 1;
          console.error(
            `❌ Ітерація №${i} [${profile}]: HTTP ${String(status)}`,
          );
          if (details.length > 0) {
            console.error(JSON.stringify(details.slice(0, 2), null, 2));
          }
        }
      } else {
        stats.serverCrashed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Ітерація №${i}: ${message}`);
      }
    }

    if (i < iterations) {
      await delay(FUZZ_INTER_REQUEST_MS);
    }
  }

  printFuzzSummary({
    iterations,
    stats,
    profileCounts,
    deadlockCount: deadlockScenarios.length,
  });

  if (stats.rateLimited > 0) {
    console.log(
      'Підказка: для fuzz локально у backend/.env — RATE_LIMIT_DISABLED=true (dev) або RATE_LIMIT_CALC_PER_15M=500.',
    );
  }

  const firstDeadlock = deadlockScenarios[0];
  if (firstDeadlock) {
    console.log(
      `Deadlock sample [${firstDeadlock.profile}] #${firstDeadlock.iteration}:`,
    );
    console.log(firstDeadlock.warnings.join('\n'));
  }

  // Жорсткі збої API — fail; 429 після повторів — теж fail; WARN/400 лишаються інформативними.
  if (stats.serverCrashed > 0 || stats.rateLimited > 0) {
    process.exitCode = 1;
  }
}

/**
 * Компактна таблична сводка — без довгих рядків і emoji,
 * щоб Git Bash / вузький термінал не ламав переноси посередині слів.
 */
function printFuzzSummary(args: {
  iterations: number;
  stats: FuzzStats;
  profileCounts: Record<FuzzProfile, number>;
  deadlockCount: number;
}): void {
  const { iterations, stats, profileCounts, deadlockCount } = args;
  const n = (value: number): string => String(value).padStart(4, ' ');
  const row = (label: string, value: number): string =>
    `${label.padEnd(18, ' ')}${n(value)}`;

  console.log('');
  console.log(`--- FUZZ SUMMARY (${iterations}) ---`);
  console.log(row('ok_clean', stats.successful));
  console.log(row('ok_warnings', stats.withWarnings));
  console.log(row('http_400', stats.validationFailed));
  console.log(row('http_429', stats.rateLimited));
  console.log(row('http_5xx_net', stats.serverCrashed));
  console.log(
    `profiles          apt=${profileCounts.apartment_mixed_ufh} house=${profileCounts.house_radiators_ufh}`,
  );
  if (deadlockCount > 0) {
    console.log(row('deadlocks', deadlockCount));
  }
  console.log('-----------------------------');
  console.log('');
}

const iterationsArg = Number.parseInt(process.argv[2] ?? '50', 10);
const iterations =
  Number.isFinite(iterationsArg) && iterationsArg > 0 ? iterationsArg : 50;

runFuzzTests(iterations).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fuzz runner failed: ${message}`);
  process.exitCode = 1;
});
