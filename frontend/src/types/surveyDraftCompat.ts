/**
 * Назначение: минимальные типы устаревших полей черновика (только load-path).
 */

/** Ветка wiringLayoutV3 до переименования pipeLengthToEquipmentM. */
export type LegacyWiringBranch = {
  roomId: string;
  pipeLengthToEquipmentM?: number;
  estimatedLengthM?: number;
};
