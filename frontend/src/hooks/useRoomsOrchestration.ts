/**
 * Назначение: Хук оркестрации помещений и objectMeta.
 * Описание: Синхронизация комнат с roomsCount, пресетами и границами квартиры в стояке.
 */

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { DEFAULT_WINDOW_PRESET_ID } from '../data/fallbackEnvelopePresets';
import type { EnvelopePreset, ObjectMetaValue } from '../types/envelope';
import type { RoomFormValue } from '../types/rooms';
import { migrateObjectMetaExternalWalls } from '../utils/migrateLegacyExternalWalls';
import {
  normalizeApartmentStackPosition,
  recommendedApartmentEnvelopePresets,
  resolveApartmentRoomBoundaries,
  defaultHouseBottomBoundary,
} from '../utils/apartmentStackBoundaries';
import { createDefaultExternalWall, migrateRoomEnvelopeFields } from '../utils/roomEnvelopeFields';
import { defaultLayoutForRoomType } from '../utils/roomExteriorLayout';
import { createDefaultWindowFormValue } from '../utils/roomWindowDefaults';

/**
 * Синхронизация списка комнат и objectMeta со справочником пресетов и roomsCount / этажностью.
 * Наружные стены (несущий слой + утеплитель) — только в objectMeta.externalWalls.
 */
export function useRoomsOrchestration(params: {
  objectMeta: ObjectMetaValue;
  setObjectMeta: Dispatch<SetStateAction<ObjectMetaValue>>;
  setRooms: Dispatch<SetStateAction<RoomFormValue[]>>;
  wallPresets: EnvelopePreset[];
  floorPresets: EnvelopePreset[];
  ceilingPresets: EnvelopePreset[];
  roofPresets: EnvelopePreset[];
  windowPresets: EnvelopePreset[];
}) {
  const {
    objectMeta,
    setObjectMeta,
    setRooms,
    wallPresets,
    floorPresets,
    ceilingPresets,
    roofPresets,
    windowPresets,
  } = params;

  const roomEnvelopeMigratedRef = useRef(false);

  /** Миграция legacy-полей комнат — один раз после монтирования. */
  useEffect(() => {
    if (roomEnvelopeMigratedRef.current) return;
    roomEnvelopeMigratedRef.current = true;
    setRooms((prev) => {
      const next = migrateRoomEnvelopeFields(prev);
      return next === prev ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- не привязываем к setRooms: иначе цикл dispatch
  }, []);

  /** Миграция wall_pps_* и ошибочного insul_* в presetId стены. */
  useEffect(() => {
    setObjectMeta((prev) => {
      const nextEw = migrateObjectMetaExternalWalls(prev.externalWalls);
      if (nextEw === prev.externalWalls) return prev;
      return { ...prev, externalWalls: nextEw };
    });
  }, [setObjectMeta]);

  /** Актуальные дефолты для новых комнат (ref, чтобы эффект роста списка не зависел от массивов пресетов). */
  const newRoomTemplateRef = useRef({
    floor: '',
    ceiling: '',
    roof: '',
    windowFirst: DEFAULT_WINDOW_PRESET_ID,
  });

  useEffect(() => {
    newRoomTemplateRef.current = {
      floor: floorPresets[0]?.id ?? '',
      ceiling: ceilingPresets[0]?.id ?? '',
      roof: roofPresets[0]?.id ?? '',
      windowFirst: windowPresets[0]?.id ?? DEFAULT_WINDOW_PRESET_ID,
    };
  }, [floorPresets, ceilingPresets, roofPresets, windowPresets]);

  /** Если этажность объекта уменьшили, номер этажа комнаты не должен превышать max — иначе селект «Этаж» пустой/битый. */
  useEffect(() => {
    const maxF = objectMeta.floors;
    setRooms((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (r.floor <= maxF) return r;
        changed = true;
        return { ...r, floor: maxF };
      });
      return changed ? next : prev;
    });
  }, [objectMeta.floors, setRooms]);

  useEffect(() => {
    // При первой загрузке пресетов выставляем дефолты для комнат (пол, потолок, кровля).
    const floorDefault = floorPresets[0]?.id ?? '';
    const ceilingDefault = ceilingPresets[0]?.id ?? '';
    const roofDefault = roofPresets[0]?.id ?? '';

    if (!floorDefault && !ceilingDefault && !roofDefault) return;
    const hasFloor = (id: string) => floorPresets.some((p) => p.id === id);
    const hasCeiling = (id: string) => ceilingPresets.some((p) => p.id === id);
    const hasRoof = (id: string) => roofPresets.some((p) => p.id === id);

    setObjectMeta((prev) => {
      if (!roofDefault) return prev;
      if (!prev.roofPresetId || !hasRoof(prev.roofPresetId)) {
        return { ...prev, roofPresetId: roofDefault };
      }
      return prev;
    });
    setRooms((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        const patch: Partial<RoomFormValue> = {};
        if (floorDefault && (!r.floorPresetId || !hasFloor(r.floorPresetId)))
          patch.floorPresetId = floorDefault;
        if (ceilingDefault && (!r.ceilingPresetId || !hasCeiling(r.ceilingPresetId)))
          patch.ceilingPresetId = ceilingDefault;
        if (roofDefault && (!r.roofPresetId || !hasRoof(r.roofPresetId)))
          patch.roofPresetId = roofDefault;
        if (Object.keys(patch).length === 0) return r;
        changed = true;
        return { ...r, ...patch };
      });
      return changed ? next : prev;
    });
  }, [ceilingPresets, floorPresets, roofPresets, setObjectMeta, setRooms]);

  useEffect(() => {
    const targetCount = objectMeta.roomsCount ?? 1;
    const d = newRoomTemplateRef.current;
    setRooms((prev) => {
      if (prev.length === targetCount) return prev;
      if (prev.length > targetCount) return prev.slice(0, targetCount);

      const next = [...prev];
      for (let i = prev.length + 1; i <= targetCount; i += 1) {
        const defaultWindowPresetId = d.windowFirst;
        next.push({
          id: `r${i}`,
          name: `Комната ${i}`,
          type: 'помещение',
          floor: 1,
          topBoundaryType: 'heated',
          bottomBoundaryType: 'heated',
          areaM2: '',
          heightM: 2.7,
          floorPresetId: d.floor,
          ceilingPresetId: d.ceiling,
          roofPresetId: d.roof,
          externalWall1: createDefaultExternalWall(),
          externalWall2: createDefaultExternalWall(),
          roomExteriorLayout: defaultLayoutForRoomType('помещение'),
          ceilingAreaM2: '',
          roofAreaM2: '',
          windows: defaultWindowPresetId
            ? [createDefaultWindowFormValue(`r${i}`, 1, defaultWindowPresetId)]
            : [],
        });
      }
      return next;
    });
  }, [objectMeta.roomsCount, setRooms]);

  useEffect(() => {
    if (!objectMeta.externalWalls.presetId && wallPresets.length > 0) {
      setObjectMeta((prev) => ({
        ...prev,
        externalWalls: { ...prev.externalWalls, presetId: wallPresets[0].id },
      }));
    }
  }, [objectMeta.externalWalls.presetId, setObjectMeta, wallPresets]);

  const lastWallPresetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const presetId = objectMeta.externalWalls.presetId;
    if (!presetId) return;
    const preset = wallPresets.find((p) => p.id === presetId) ?? null;
    const options = preset?.thicknessOptionsMm ?? null;
    const current = objectMeta.externalWalls.thicknessMm;

    const presetChanged = lastWallPresetIdRef.current !== presetId;
    lastWallPresetIdRef.current = presetId;

    if (!presetChanged && current != null) return;

    let next: number | undefined;
    if (options && options.length > 0) {
      next = options[0];
    } else if (preset?.material) {
      const m = preset.material.match(/(\d{2,4})\s*мм/i);
      if (m?.[1]) next = Number(m[1]);
    }

    if (next == null) return;
    if (next === current) return;

    setObjectMeta((prev) => ({
      ...prev,
      externalWalls: { ...prev.externalWalls, thicknessMm: next },
    }));
  }, [
    objectMeta.externalWalls.presetId,
    objectMeta.externalWalls.thicknessMm,
    setObjectMeta,
    wallPresets,
  ]);

  /** Квартира в МКД: границы и пресеты пола/потолка по положению в стояке. */
  useEffect(() => {
    if (objectMeta.objectType !== 'apartment') return;
    const stack = normalizeApartmentStackPosition(objectMeta.apartmentStackPosition);
    const maxF = objectMeta.floors;
    const hasFloor = (id: string) => floorPresets.some((p) => p.id === id);
    const hasCeiling = (id: string) => ceilingPresets.some((p) => p.id === id);

    setRooms((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        const bounds = resolveApartmentRoomBoundaries(stack, r.floor, maxF);
        const presets = recommendedApartmentEnvelopePresets(
          bounds.bottomBoundary,
          bounds.topBoundary,
        );
        const floorPresetId = hasFloor(presets.floorPresetId)
          ? presets.floorPresetId
          : r.floorPresetId;
        const ceilingPresetId = hasCeiling(presets.ceilingPresetId)
          ? presets.ceilingPresetId
          : r.ceilingPresetId;
        const topBoundaryType =
          r.topBoundaryType === 'roof' ? r.topBoundaryType : bounds.topBoundary;
        if (
          r.bottomBoundaryType === bounds.bottomBoundary
          && topBoundaryType === bounds.topBoundary
          && r.floorPresetId === floorPresetId
          && r.ceilingPresetId === ceilingPresetId
        ) {
          return r;
        }
        changed = true;
        return {
          ...r,
          bottomBoundaryType: bounds.bottomBoundary,
          topBoundaryType,
          floorPresetId,
          ceilingPresetId,
        };
      });
      return changed ? next : prev;
    });
  }, [
    objectMeta.objectType,
    objectMeta.apartmentStackPosition,
    objectMeta.floors,
    floorPresets,
    ceilingPresets,
    setRooms,
  ]);

  /** Дом: нижняя граница по этажу комнаты, если не задана. */
  useEffect(() => {
    if (objectMeta.objectType === 'apartment') return;
    setRooms((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        const bb = defaultHouseBottomBoundary(r.floor);
        if (r.bottomBoundaryType === bb) return r;
        changed = true;
        return { ...r, bottomBoundaryType: bb };
      });
      return changed ? next : prev;
    });
  }, [objectMeta.objectType, setRooms]);
}
