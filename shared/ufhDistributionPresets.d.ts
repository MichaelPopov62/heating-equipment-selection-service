export type UfhDistributionPreset =
  | 'auto'
  | 'collector_mixing_valve'
  | 'hydraulic_separator';

export interface UfhDistributionAutoRules {
  autoHydraulicSeparatorMinBoilerKw?: number;
  autoHydraulicSeparatorMinRoomsCount?: number;
}

export type UfhDistributionResolveCtx = {
  objectType?: 'apartment' | 'house' | string;
  roomsWithUfhCount?: number;
  requiredBoilerKw?: number;
  autoRules?: UfhDistributionAutoRules;
};

export declare const UFH_DISTRIBUTION_PRESET_IDS: readonly UfhDistributionPreset[];

export declare const UFH_DISTRIBUTION_PRESET_LABELS: Readonly<
  Record<UfhDistributionPreset, string>
>;

export declare const UFH_DISTRIBUTION_UI_OPTIONS: readonly {
  value: UfhDistributionPreset;
  label: string;
}[];

export declare function isUfhDistributionPreset(
  value: string | undefined | null,
): value is UfhDistributionPreset;

export declare function resolveAutoUfhDistributionPreset(
  ctx: UfhDistributionResolveCtx,
): Exclude<UfhDistributionPreset, 'auto'>;

export declare function resolveUfhDistributionPreset(
  requested: UfhDistributionPreset | undefined | null,
  ctx: UfhDistributionResolveCtx,
): Exclude<UfhDistributionPreset, 'auto'>;
