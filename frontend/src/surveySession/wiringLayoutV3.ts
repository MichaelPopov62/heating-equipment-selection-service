/**
 * Назначение: контракт layout v3 разводки (черновик анкеты).
 * Описание: flat consumers/branches → дефолтная схема; systemType auto = серверный buildGraph.
 */

import type { RoomFormValue } from '../types/rooms';

/** Тип схемы разводки (auto — текущий buildGraph на backend). */
export type WiringSystemType =
  | 'auto'
  | 'two-pipe-dead-end'
  | 'two-pipe-pass'
  | 'manifold';

/** Ветка радиаторного контура в layout v3. */
export type WiringBranchV3 = {
  roomId: string;
  estimatedLengthM: number;
};

/** Layout разводки в черновике анкеты. */
export type WiringLayoutV3 = {
  schemaVersion: 3;
  systemType: WiringSystemType;
  branches: WiringBranchV3[];
  metadata: {
    migratedFrom: 'flat-v2' | 'native-v3';
    updatedAt: string | null;
  };
};

/** Эталон «чистого» layout (глубокая копия при сбросе). */
export const DEFAULT_WIRING_LAYOUT: WiringLayoutV3 = {
  schemaVersion: 3,
  systemType: 'auto',
  branches: [],
  metadata: {
    migratedFrom: 'flat-v2',
    updatedAt: null,
  },
};

/**
 * @returns {WiringLayoutV3} Копия дефолтного layout.
 */
export function createDefaultWiringLayout(): WiringLayoutV3 {
  return structuredClone(DEFAULT_WIRING_LAYOUT);
}

/**
 * Сравнение веток layout (порядок и длины).
 *
 * @param a
 * @param b
 */
function branchesEqual(a: WiringBranchV3[], b: WiringBranchV3[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].roomId !== b[i].roomId) return false;
    if (a[i].estimatedLengthM !== b[i].estimatedLengthM) return false;
  }
  return true;
}

/**
 * Упаковка плоского списка комнат в дефолтную двухтрубную разводку.
 *
 * @param rooms — комнаты анкеты
 * @param systemType — целевой тип схемы
 * @param defaultBranchLengthM — длина ветки по умолчанию
 * @param prev — предыдущий layout; при неизменных ветках возвращается как есть
 */
export function adaptFlatRoomsToWiringLayout(
  rooms: RoomFormValue[],
  systemType: WiringSystemType = 'auto',
  defaultBranchLengthM = 4,
  prev?: WiringLayoutV3,
): WiringLayoutV3 {
  const branches: WiringBranchV3[] = [];
  for (const room of rooms) {
    if (!room.id) continue;
    branches.push({
      roomId: room.id,
      estimatedLengthM: defaultBranchLengthM,
    });
  }

  if (
    prev != null
    && prev.systemType === systemType
    && branchesEqual(prev.branches, branches)
  ) {
    return prev;
  }

  return {
    schemaVersion: 3,
    systemType,
    branches,
    metadata: {
      migratedFrom: prev?.metadata.migratedFrom ?? 'flat-v2',
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Миграция layout при смене systemType с сохранением roomId/длин где возможно.
 *
 * @param prev — предыдущий layout
 * @param rooms — актуальные комнаты
 * @param nextSystemType — новый тип
 * @param defaultBranchLengthM — fallback длины
 */
export function migrateWiringLayoutOnSystemTypeChange(
  prev: WiringLayoutV3,
  rooms: RoomFormValue[],
  nextSystemType: WiringSystemType,
  defaultBranchLengthM = 4,
): WiringLayoutV3 {
  if (nextSystemType === 'auto' || prev.branches.length === 0) {
    return adaptFlatRoomsToWiringLayout(
      rooms,
      nextSystemType,
      defaultBranchLengthM,
      prev,
    );
  }

  const roomIds = new Set(rooms.map((r) => r.id).filter(Boolean));
  const kept = prev.branches.filter((b) => roomIds.has(b.roomId));
  const keptIds = new Set(kept.map((b) => b.roomId));

  for (const room of rooms) {
    if (!room.id || keptIds.has(room.id)) continue;
    kept.push({ roomId: room.id, estimatedLengthM: defaultBranchLengthM });
  }

  if (
    nextSystemType === prev.systemType
    && branchesEqual(kept, prev.branches)
  ) {
    return prev;
  }

  return {
    schemaVersion: 3,
    systemType: nextSystemType,
    branches: kept,
    metadata: {
      migratedFrom: prev.metadata.migratedFrom === 'native-v3' ? 'native-v3' : 'flat-v2',
      updatedAt: new Date().toISOString(),
    },
  };
}
