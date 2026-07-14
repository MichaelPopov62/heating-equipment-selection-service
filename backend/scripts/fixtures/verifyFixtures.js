/**
 * Назначение: типизированные фикстуры для verify-скриптов backend/scripts.
 * Описание: минимальные валидные объекты с дефолтами для strict checkJs.
 */

/** @typedef {import('../../src/types/shared-types.js').BuildingObjectMetaExternalWalls} BuildingObjectMetaExternalWalls */
/** @typedef {import('../../src/types/shared-types.js').BuildingObjectMeta} BuildingObjectMeta */
/** @typedef {import('../../src/types/shared-types.js').BuildingInput} BuildingInput */
/** @typedef {import('../../src/types/shared-types.js').RoomInput} RoomInput */
/** @typedef {import('../../src/types/shared-types.js').RoomType} RoomType */
/** @typedef {import('../../src/types/shared-types.js').HeatLossRoomReport} HeatLossRoomReport */
/** @typedef {import('../../src/types/shared-types.js').HeatLossReport} HeatLossReport */
/** @typedef {import('../../src/types/shared-types.js').UnderfloorHeatingRoomReport} UnderfloorHeatingRoomReport */
/** @typedef {import('../../src/types/shared-types.js').UnderfloorHeatingReport} UnderfloorHeatingReport */
/** @typedef {import('../../src/hydraulics/types.js').HydraulicsGraphEdge} HydraulicsGraphEdge */
/** @typedef {import('../../src/hydraulics/types.js').HydraulicsRadiatorsCircuit} HydraulicsRadiatorsCircuit */
/** @typedef {import('../../src/hydraulics/types.js').HydraulicsPressureReport} HydraulicsPressureReport */
/** @typedef {import('../../src/types/boiler-types.js').BoilerEquipmentProposal} BoilerEquipmentProposal */
/** @typedef {import('../../src/types/boiler-types.js').BoilerMatchingReport} BoilerMatchingReport */

/** @type {BuildingObjectMetaExternalWalls} */
export const DEFAULT_EXTERNAL_WALLS = {
  presetId: 'wall_gas_concrete_d500',
  thicknessMm: 375,
  facadeSystem: 'none',
};

/** @type {import('../../src/hydraulics/types.js').HydraulicsRules['localLossZeta']} */
export const DEFAULT_LOCAL_LOSS_ZETA = {
  elbow90: 0.5,
  teeBranch: 1.5,
  teePass: 0.6,
  teeBranchTakeoff: 1.2,
  mixingNode: 2,
  collector: 1,
};

/**
 * @param {Partial<BuildingObjectMeta> & Pick<BuildingObjectMeta, 'objectType'>} partial
 * @returns {BuildingObjectMeta}
 */
export function buildObjectMeta(partial) {
  return {
    floors: 1,
    roomsCount: 1,
    externalWalls: DEFAULT_EXTERNAL_WALLS,
    ...partial,
  };
}

/**
 * @param {Partial<RoomInput> & Pick<RoomInput, 'id' | 'name'>} partial
 * @returns {RoomInput}
 */
export function buildRoom(partial) {
  return {
    type: 'гостиная',
    floor: 1,
    topBoundary: 'heated',
    bottomBoundary: 'unheated',
    areaM2: 12,
    heightM: 2.7,
    ...partial,
  };
}

/**
 * @param {Partial<HeatLossRoomReport> & Pick<HeatLossRoomReport, 'id' | 'name'>} partial
 * @returns {HeatLossRoomReport}
 */
export function buildHeatLossRoom(partial) {
  return {
    type: 'гостиная',
    areaM2: 12,
    heightM: 2.7,
    volumeM3: 32.4,
    envelopeWatts: 1000,
    designWatts: 1000,
    elements: [],
    ...partial,
  };
}

/**
 * @param {Partial<HeatLossReport>} [partial]
 * @returns {HeatLossReport}
 */
export function buildHeatLossReport(partial = {}) {
  return {
    totalWatts: 1000,
    rooms: [],
    ...partial,
  };
}

/**
 * @param {string} roomId
 * @param {string} roomName
 * @param {number} loopsCount
 * @param {Partial<UnderfloorHeatingRoomReport>} [partial]
 * @returns {UnderfloorHeatingRoomReport}
 */
export function buildUfhRoom(roomId, roomName, loopsCount, partial = {}) {
  return {
    roomId,
    roomName,
    basePresetId: 'ufh_base_interstory_screed_65',
    finishMaterialId: 'ceramic_tile',
    roomAreaM2: 12,
    furnitureOccupiedAreaM2: 0,
    heatedAreaM2: 12,
    areaM2: 12,
    requestedPipeSpacingMm: 150,
    resolvedPipeSpacingMm: 150,
    pipeSpacingResolution: 'matched_requested',
    pipeSpacingMm: 150,
    loopsCount,
    heatFluxUpWatts: 1000,
    heatFluxDownWatts: 100,
    heatFluxUpWm2: 80,
    heatFluxDownWm2: 8,
    maxAllowableHeatFluxUpWm2: 100,
    surfaceTempC: 26,
    maxSurfaceTemperatureCelsius: 29,
    pipeEmbedmentResistanceM2KW: 0.05,
    baseCoveringResistanceM2KW: 0,
    finishCoveringResistanceM2KW: 0.05,
    coveringResistanceM2KW: 0.05,
    resistanceUpM2KW: 0.1,
    resistanceDownM2KW: 0.5,
    circuitSupplyC: 40,
    circuitReturnC: 30,
    circuitMeanC: 35,
    bottomBoundary: 'heated',
    neighborTempC: 20,
    warnings: [],
    ...partial,
  };
}

/**
 * @param {Partial<UnderfloorHeatingReport>} partial
 * @returns {UnderfloorHeatingReport}
 */
export function buildUfhReport(partial) {
  return {
    enabled: true,
    circuitSupplyC: 40,
    circuitReturnC: 30,
    circuitMeanC: 35,
    circuitSource: 'finish_preset',
    rooms: [],
    totalHeatFluxUpWatts: 0,
    totalHeatFluxDownWatts: 0,
    warnings: [],
    ...partial,
  };
}

/**
 * @param {Partial<HydraulicsRadiatorsCircuit>} [partial]
 * @returns {HydraulicsRadiatorsCircuit}
 */
export function buildHydraulicsRadiatorsCircuit(partial = {}) {
  return {
    thermalRegime: { supplyC: 75, returnC: 65, deltaTK: 10 },
    flowDeltaTK: 10,
    connectionType: 'side',
    consumers: [],
    totalFlowRateM3PerHour: 0,
    ...partial,
  };
}

/**
 * @param {Partial<HydraulicsPressureReport>} [partial]
 * @returns {HydraulicsPressureReport}
 */
export function buildHydraulicsPressureReport(partial = {}) {
  return {
    criticalLoopEdgeIds: [],
    headRequiredM: 0,
    circulationLoops: [],
    segments: [],
    ...partial,
  };
}

/**
 * @param {Partial<HydraulicsGraphEdge> & Pick<HydraulicsGraphEdge, 'id' | 'from' | 'to'>} partial
 * @returns {HydraulicsGraphEdge}
 */
export function buildHydraulicsGraphEdge(partial) {
  return {
    lengthM: 1,
    fluid: 'water',
    designFlowM3PerHour: 0.5,
    segmentRole: 'branch',
    ...partial,
  };
}

/**
 * @param {Partial<BoilerEquipmentProposal> & Pick<BoilerEquipmentProposal, 'headline' | 'model'>} partial
 * @returns {BoilerEquipmentProposal}
 */
export function buildBoilerEquipmentProposal(partial) {
  return {
    kind: 'single',
    unitsCount: 1,
    unitMaxPowerKw: 24,
    totalNominalKw: 24,
    requiredKw: 24,
    powerRequirementBreakdown: { heatingLoadKw: 0.8, hotWaterPowerKw: 0 },
    nominalReservePercent: 100,
    advantages: [],
    notes: [],
    ...partial,
  };
}

/**
 * @param {Partial<BoilerMatchingReport>} [partial]
 * @returns {BoilerMatchingReport}
 */
export function buildMinimalBoilerMatchingReport(partial = {}) {
  return {
    heatLossKw: 8,
    reserveFactor: 1.15,
    hotWaterPowerKw: 0,
    heatingLoadKw: 9.2,
    hotWaterBoilerPowerMatchingScheme: 'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
    requiredKw: 24,
    condensingHeatingReserveFactor: 1.1,
    heatingLoadKwCondensing: 10.12,
    requiredKwForCondensingLine: 24,
    selected: null,
    warnings: [],
    recommendations: [],
    ...partial,
  };
}

/**
 * @param {Partial<BuildingInput> & Pick<BuildingInput, 'rooms'>} partial
 * @returns {BuildingInput}
 */
export function buildBuildingInput(partial) {
  return {
    envelopeElements: [],
    ...partial,
  };
}

/**
 * Минимальный NormalizedCatalog для verify-скриптов (подмножество полей каталога).
 *
 * @param {Partial<import('../../src/catalog/types.js').NormalizedCatalog>} partial
 * @returns {import('../../src/catalog/types.js').NormalizedCatalog}
 */
export function buildPartialCatalog(partial) {
  return {
    boilers: { doubleCircuit: [], singleCircuit: [] },
    radiators: [],
    waterHeaters: [],
    ...partial,
  };
}
