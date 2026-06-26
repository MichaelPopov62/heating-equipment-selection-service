/**
 * Назначение: типы справочников ГВС и appliances.
 * Описание: TypeScript-декларации нормализованных water_norms, appliances и связанных структур
 * для JS-модулей домена dhw; не участвует в рантайме.
 */
export interface NormalizedWaterNorms {
  schemaVersion: number;
  label: string;
  objectTypes: {
    house: { simultaneityBase: number; dhwSupplyScenario: 'storage' | 'flowThrough' };
    apartment: { simultaneityBase: number; dhwSupplyScenario: 'storage' | 'flowThrough' };
  };
  /** Нормы объёма накопительного электробойлера для квартиры (схема 1К + электро). */
  apartmentElectricStorage: {
    litersPerResident: number;
    minTankLiters: number;
  };
  /** Объём буферного электробойлера при схеме 2К + буфер (combiBoilerWithBufferElectricStorage). */
  combiBufferElectricStorage: {
    litersPerResident: number;
    minTankLiters: number;
  };
  /** Объём буферного электробойлера при схеме 1К + буфер (singleCircuitBoilerWithBufferElectricStorage). */
  singleCircuitBufferElectricStorage: {
    litersPerResident: number;
    minTankLiters: number;
  };
  simultaneity: {
    residentsFactorPerPerson: number;
    residentsFactorCap: number;
    fixtureCountDivisor: number;
    betaMin: number;
    betaMax: number;
  };
  fixtureHotFlowLps: Record<string, number>;
  hotThermalFixtureKeys: string[];
  /** Не участвуют в пиковой проточной мощности ГВС для квартиры (греют ТЭНом от ХВ). */
  hotThermalFixtureKeysExcludedForApartment: string[];
  coldWaterDesignC: { winter: number; summer: number };
  hotWaterC: { min: number; max: number; default: number };
  storage: {
    litersPerResident: number;
    bathMinTankLiters: number;
    tropicalShowerVolumeFactor: number;
    indirectHeatTimeMinutes: number;
    boilerDhwPowerMinKw: number;
    volumeSubstitutionFactor: number;
    typicalTankSizes: number[];
  };
  session: {
    bathLiters: number;
    showerLiters: number;
    kitchenSinkLiters: number;
    bathroomSinkLiters: number;
    minMixedLiters: number;
    kitchenSinkCap: number;
    bathroomSinkCap: number;
    showerUsesResidentsDivisor: number;
  };
  physics: { cpKjPerKgK: number; rhoKgPerL: number };
}

export type ApplianceKind =
  | 'indirect_water_heater'
  | 'boiler'
  | 'electric_storage'
  | 'radiator'
  | 'underfloor_heating'
  | 'hydraulics';

export interface HydraulicsApplianceRulesDoc {
  applianceKind: 'hydraulics';
  schemaVersion: number;
  label: string;
  velocityLimitsMps: { mainMax: number; branchMax: number; mainMin: number };
  defaultLengthsM: {
    mainLine: number;
    radiatorBranch: number;
    ufhCollectorBranch: number;
  };
  maxUfhLoopLengthM: number;
  ufhLoopDeltaTK: number;
  ufhLoopVelocityMinMps: number;
  ufhLoopVelocityMaxMps: number;
  maxUfhLoopPressureDropKPa: number;
  roughnessMmByMaterial: Record<string, number>;
  localLossZeta: {
    elbow90: number;
    teeBranch: number;
    mixingNode: number;
    collector: number;
  };
  pumpHeadMarginPercent: number;
  pumpDutyQMaxUtilizationPercent: number;
  pumpMinHeadAtDutyM: number;
  pumpMaxHeadMarginPercent: number;
  pumpMinHeadAtQMaxM: number;
  primaryFlowMarginPercent: number;
  balancingValveKPaPerTurn: number;
}

export interface UnderfloorHeatingDistributionRules {
  autoHydraulicSeparatorMinBoilerKw: number;
  autoHydraulicSeparatorMinRoomsCount: number;
}

export interface UnderfloorHeatingMixingNodeRules {
  deltaTK: number;
  valvePressureDropBar: number;
  headMetersMinCollector: number;
  headMetersMinHydraulicSeparator: number;
}

export interface UnderfloorHeatingApplianceRules {
  applianceKind: 'underfloor_heating';
  schemaVersion: number;
  label: string;
  distribution: UnderfloorHeatingDistributionRules;
  mixingNode: UnderfloorHeatingMixingNodeRules;
}

export interface IndirectWaterHeaterApplianceRules {
  applianceKind: 'indirect_water_heater';
  schemaVersion: number;
  label: string;
  coupling: {
    heatTimeSoftHintMinutes: number;
    heatTimeParasiticHintMinutes: number;
    boilerBelowMinSourceToleranceKw: number;
    coilWeakerThanBoilerToleranceKw: number;
    effectivePowerUsesMinOfCoilAndBoiler: boolean;
  };
  selection: {
    sortByVolumeAsc: boolean;
    pickFirstGteRequired: boolean;
  };
}

export interface BoilerApplianceRules {
  applianceKind: 'boiler';
  schemaVersion: number;
  label: string;
  mounting: {
    boilerRoomType: string;
    minBoilerRoomVolumeM3: number;
    minBoilerRoomHeightM: number;
    maxApartmentNominalKw: number;
  };
  matching: {
    heatingReserveFactor: number;
    condensingHeatingReserveFactor: number;
    cascadeHintMinKw: number;
    nominalReservePercentCap: number;
  };
  hints: {
    comfortHotWaterHeatPartKwMax: number;
    comfortHotWaterDhwKwMax: number;
    comfortHotWaterTypicalBoilerKw: number;
    apartmentCombiSerialBuffer: {
      enabled: boolean;
      bufferTankLitersMin: number;
      bufferTankLitersMax: number;
      peakThermalPowerKwMin: number;
      minThermalFixtures: number;
    };
  };
  apartmentClassification: {
    largeAreaM2Min: number;
    largeHeatingLoadKwMin: number;
    minBathroomsForLargeApartment: number;
    singleCircuitOversizeRatio: number;
  };
}

export interface ElectricStorageApplianceRules {
  applianceKind: 'electric_storage';
  schemaVersion: number;
  label: string;
  matching: Record<string, never>;
}

export interface RadiatorApplianceRules {
  applianceKind: 'radiator';
  schemaVersion: number;
  label: string;
  panelLengthRangeMm: { min: number; max: number };
}

export type NormalizedApplianceRules =
  | IndirectWaterHeaterApplianceRules
  | BoilerApplianceRules
  | ElectricStorageApplianceRules
  | RadiatorApplianceRules
  | UnderfloorHeatingApplianceRules
  | HydraulicsApplianceRulesDoc;

/** Загруженные правила по категориям техники. */
export interface AppliancesBundle {
  byKind: {
    indirect_water_heater: IndirectWaterHeaterApplianceRules;
    boiler: BoilerApplianceRules;
    electric_storage: ElectricStorageApplianceRules;
    radiator: RadiatorApplianceRules;
    underfloor_heating: UnderfloorHeatingApplianceRules;
    hydraulics: HydraulicsApplianceRulesDoc;
  };
  schemaVersions: Partial<Record<ApplianceKind, number>>;
  source: 'file' | 'mongo';
}
