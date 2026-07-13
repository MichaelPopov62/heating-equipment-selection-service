/**
 * Назначение: типы resolve расчётной T воздуха помещения.
 * Описание: Декларации для TypeScript рядом с roomDesignAirTemp.js.
 */

export declare const BATHROOM_ROOM_TYPE: 'санузел';

export declare const BATHROOM_DESIGN_AIR_TEMP_FLOOR_C: 24;

export declare const SMALL_ZONE_ROOM_TYPES: readonly string[];

export type DesignRoomAirTempSource = 'survey' | 'bathroom_field' | 'floor';

export interface DesignRoomAirTempResolved {
  designAirTempC: number;
  source: DesignRoomAirTempSource;
}

export declare function resolveDesignRoomAirTempC(args?: {
  roomType?: string | null;
  insideC?: number;
  bathroomAirTempC?: number | null;
}): DesignRoomAirTempResolved | null;

export declare function isSmallZoneRoomType(
  roomType?: string | null,
): boolean;
