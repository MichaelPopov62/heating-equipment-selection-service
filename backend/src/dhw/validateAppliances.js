/**
 * Назначение: валидация справочника appliances.
 * Описание: проверка и нормализация правил подбора по типам техники (котёл, БКН, радиатор,
 * электробойлер); числовые пороги только из JSON/Mongo без дублирования в коде.
 */
import {
  requireFiniteNum,
  requireNonEmptyString,
  requireObject,
  requirePosNum,
} from './validateReferenceHelpers.js';

/**
 * @param {unknown} doc
 * @returns {import('./types').NormalizedApplianceRules}
 */
function validateAndNormalizeApplianceDoc(doc) {
  if (!doc || typeof doc !== 'object') {
    throw new Error('appliances: ожидается объект документа');
  }
  const d = /** @type {Record<string, unknown>} */ (doc);
  const kind = String(d.applianceKind ?? '').trim();
  const schemaVersionRaw = Number(d.schemaVersion);
  if (!Number.isFinite(schemaVersionRaw) || Math.trunc(schemaVersionRaw) < 1) {
    throw new Error(`appliances[${kind || '?'}].schemaVersion: обязательное целое >= 1`);
  }
  const schemaVersion = Math.trunc(schemaVersionRaw);
  const label = d.label != null ? String(d.label).trim() : kind;
  const basePath = `appliances[${kind || '?'}]`;

  if (kind === 'indirect_water_heater') {
    const c = requireObject(d, 'coupling', `${basePath}.coupling`);
    const sel = requireObject(d, 'selection', `${basePath}.selection`);
    return {
      applianceKind: 'indirect_water_heater',
      schemaVersion,
      label,
      coupling: {
        heatTimeSoftHintMinutes: requirePosNum(
          c,
          'heatTimeSoftHintMinutes',
          `${basePath}.coupling`,
        ),
        heatTimeParasiticHintMinutes: requirePosNum(
          c,
          'heatTimeParasiticHintMinutes',
          `${basePath}.coupling`,
        ),
        boilerBelowMinSourceToleranceKw: requirePosNum(
          c,
          'boilerBelowMinSourceToleranceKw',
          `${basePath}.coupling`,
        ),
        coilWeakerThanBoilerToleranceKw: requirePosNum(
          c,
          'coilWeakerThanBoilerToleranceKw',
          `${basePath}.coupling`,
        ),
        effectivePowerUsesMinOfCoilAndBoiler: c.effectivePowerUsesMinOfCoilAndBoiler !== false,
      },
      selection: {
        sortByVolumeAsc: sel.sortByVolumeAsc !== false,
        pickFirstGteRequired: sel.pickFirstGteRequired !== false,
      },
    };
  }

  if (kind === 'boiler') {
    const m = requireObject(d, 'mounting', `${basePath}.mounting`);
    const mt = requireObject(d, 'matching', `${basePath}.matching`);
    const h = requireObject(d, 'hints', `${basePath}.hints`);
    const sb = requireObject(
      h,
      'apartmentCombiSerialBuffer',
      `${basePath}.hints.apartmentCombiSerialBuffer`,
    );
    const ac = requireObject(d, 'apartmentClassification', `${basePath}.apartmentClassification`);
    const capRaw = Number(mt.nominalReservePercentCap);
    if (!Number.isFinite(capRaw) || Math.trunc(capRaw) < 100) {
      throw new Error(`${basePath}.matching.nominalReservePercentCap: обязательное целое >= 100`);
    }
    return {
      applianceKind: 'boiler',
      schemaVersion,
      label,
      mounting: {
        boilerRoomType: requireNonEmptyString(m, 'boilerRoomType', `${basePath}.mounting`),
        minBoilerRoomVolumeM3: requirePosNum(
          m,
          'minBoilerRoomVolumeM3',
          `${basePath}.mounting`,
        ),
        minBoilerRoomHeightM: requirePosNum(m, 'minBoilerRoomHeightM', `${basePath}.mounting`),
        maxApartmentNominalKw: requirePosNum(
          m,
          'maxApartmentNominalKw',
          `${basePath}.mounting`,
        ),
      },
      matching: {
        heatingReserveFactor: requirePosNum(
          mt,
          'heatingReserveFactor',
          `${basePath}.matching`,
        ),
        condensingHeatingReserveFactor: requirePosNum(
          mt,
          'condensingHeatingReserveFactor',
          `${basePath}.matching`,
        ),
        cascadeHintMinKw: requirePosNum(mt, 'cascadeHintMinKw', `${basePath}.matching`),
        nominalReservePercentCap: Math.trunc(capRaw),
      },
      hints: {
        comfortHotWaterHeatPartKwMax: requirePosNum(
          h,
          'comfortHotWaterHeatPartKwMax',
          `${basePath}.hints`,
        ),
        comfortHotWaterDhwKwMax: requirePosNum(
          h,
          'comfortHotWaterDhwKwMax',
          `${basePath}.hints`,
        ),
        comfortHotWaterTypicalBoilerKw: requirePosNum(
          h,
          'comfortHotWaterTypicalBoilerKw',
          `${basePath}.hints`,
        ),
        apartmentCombiSerialBuffer: {
          enabled: sb.enabled !== false,
          bufferTankLitersMin: requirePosNum(
            sb,
            'bufferTankLitersMin',
            `${basePath}.hints.apartmentCombiSerialBuffer`,
          ),
          bufferTankLitersMax: requirePosNum(
            sb,
            'bufferTankLitersMax',
            `${basePath}.hints.apartmentCombiSerialBuffer`,
          ),
          peakThermalPowerKwMin: requirePosNum(
            sb,
            'peakThermalPowerKwMin',
            `${basePath}.hints.apartmentCombiSerialBuffer`,
          ),
          minThermalFixtures: Math.max(
            1,
            Math.trunc(
              requireFiniteNum(
                sb,
                'minThermalFixtures',
                `${basePath}.hints.apartmentCombiSerialBuffer`,
              ),
            ),
          ),
        },
      },
      apartmentClassification: {
        largeAreaM2Min: requirePosNum(
          ac,
          'largeAreaM2Min',
          `${basePath}.apartmentClassification`,
        ),
        largeHeatingLoadKwMin: requirePosNum(
          ac,
          'largeHeatingLoadKwMin',
          `${basePath}.apartmentClassification`,
        ),
        minBathroomsForLargeApartment: Math.max(
          1,
          Math.trunc(
            requireFiniteNum(
              ac,
              'minBathroomsForLargeApartment',
              `${basePath}.apartmentClassification`,
            ),
          ),
        ),
        singleCircuitOversizeRatio: requirePosNum(
          ac,
          'singleCircuitOversizeRatio',
          `${basePath}.apartmentClassification`,
        ),
      },
    };
  }

  if (kind === 'electric_storage') {
    return {
      applianceKind: 'electric_storage',
      schemaVersion,
      label,
      matching: {},
    };
  }

  if (kind === 'radiator') {
    const p = requireObject(d, 'panelLengthRangeMm', `${basePath}.panelLengthRangeMm`);
    const min = Math.trunc(Number(p.min));
    const max = Math.trunc(Number(p.max));
    if (!Number.isFinite(min) || min <= 0) {
      throw new Error(`${basePath}.panelLengthRangeMm.min: обязательное целое > 0`);
    }
    if (!Number.isFinite(max) || max < min) {
      throw new Error(`${basePath}.panelLengthRangeMm.max: обязательное целое >= min`);
    }
    const ml = requireObject(d, 'microLoad', `${basePath}.microLoad`);
    const threshold = requirePosNum(
      ml,
      'minDesignWattsThreshold',
      `${basePath}.microLoad`,
    );
    const entryRaw = ml.entryRoomTypes;
    if (!Array.isArray(entryRaw) || entryRaw.length === 0) {
      throw new Error(`${basePath}.microLoad.entryRoomTypes: непустой массив строк`);
    }
    const entryRoomTypes = entryRaw.map((t, i) => {
      const s = String(t ?? '').trim();
      if (!s) {
        throw new Error(`${basePath}.microLoad.entryRoomTypes[${i}]: непустая строка`);
      }
      return s;
    });
    return {
      applianceKind: 'radiator',
      schemaVersion,
      label,
      panelLengthRangeMm: { min, max },
      microLoad: {
        minDesignWattsThreshold: threshold,
        entryRoomTypes,
      },
    };
  }

  if (kind === 'underfloor_heating') {
    const dist = requireObject(d, 'distribution', `${basePath}.distribution`);
    const mix = requireObject(d, 'mixingNode', `${basePath}.mixingNode`);
    return {
      applianceKind: 'underfloor_heating',
      schemaVersion,
      label,
      distribution: {
        autoHydraulicSeparatorMinBoilerKw: requirePosNum(
          dist,
          'autoHydraulicSeparatorMinBoilerKw',
          `${basePath}.distribution`,
        ),
        autoHydraulicSeparatorMinRoomsCount: Math.max(
          1,
          Math.trunc(
            requireFiniteNum(
              dist,
              'autoHydraulicSeparatorMinRoomsCount',
              `${basePath}.distribution`,
            ),
          ),
        ),
      },
      mixingNode: {
        deltaTK: requirePosNum(mix, 'deltaTK', `${basePath}.mixingNode`),
        valvePressureDropBar: requirePosNum(
          mix,
          'valvePressureDropBar',
          `${basePath}.mixingNode`,
        ),
        headMetersMinCollector: requirePosNum(
          mix,
          'headMetersMinCollector',
          `${basePath}.mixingNode`,
        ),
        headMetersMinHydraulicSeparator: requirePosNum(
          mix,
          'headMetersMinHydraulicSeparator',
          `${basePath}.mixingNode`,
        ),
      },
    };
  }

  if (kind === 'hydraulics') {
    const vel = requireObject(d, 'velocityLimitsMps', `${basePath}.velocityLimitsMps`);
    const len = requireObject(d, 'defaultLengthsM', `${basePath}.defaultLengthsM`);
    const zeta = requireObject(d, 'localLossZeta', `${basePath}.localLossZeta`);
    const rough = requireObject(d, 'roughnessMmByMaterial', `${basePath}.roughnessMmByMaterial`);
    const rec = {
      applianceKind: 'hydraulics',
      schemaVersion,
      label,
      mainTransitMinInternalDiameterMm: (() => {
        if (d.mainTransitMinInternalDiameterMm == null) return 20;
        return requirePosNum(d, 'mainTransitMinInternalDiameterMm', basePath);
      })(),
      branchMinInternalDiameterMm: (() => {
        if (d.branchMinInternalDiameterMm == null) return 12;
        return requirePosNum(d, 'branchMinInternalDiameterMm', basePath);
      })(),
      velocityLimitsMps: {
        mainMax: requirePosNum(vel, 'mainMax', `${basePath}.velocityLimitsMps`),
        branchMax: requirePosNum(vel, 'branchMax', `${basePath}.velocityLimitsMps`),
        mainMin: requirePosNum(vel, 'mainMin', `${basePath}.velocityLimitsMps`),
        ...(vel.branchMin != null
          ? {
            branchMin: (() => {
              const n = Number(vel.branchMin);
              if (!Number.isFinite(n) || n < 0) {
                throw new Error(`${basePath}.velocityLimitsMps.branchMin: число ≥ 0`);
              }
              return n;
            })(),
          }
          : { branchMin: 0 }),
      },
      radiatorBranchGrouping: (() => {
        if (d.radiatorBranchGrouping == null) {
          return {
            minFlowM3PerHourForIndividualBranch: 0.019,
            minHeatLoadWattsForIndividualBranch: 150,
            manifoldTrunkLengthM: 2,
            localZetaManifold: 1.5,
          };
        }
        const g = requireObject(d, 'radiatorBranchGrouping', `${basePath}.radiatorBranchGrouping`);
        const gp = `${basePath}.radiatorBranchGrouping`;
        return {
          minFlowM3PerHourForIndividualBranch: requirePosNum(
            g,
            'minFlowM3PerHourForIndividualBranch',
            gp,
          ),
          minHeatLoadWattsForIndividualBranch: requirePosNum(
            g,
            'minHeatLoadWattsForIndividualBranch',
            gp,
          ),
          manifoldTrunkLengthM: requirePosNum(g, 'manifoldTrunkLengthM', gp),
          localZetaManifold: requirePosNum(g, 'localZetaManifold', gp),
        };
      })(),
      defaultLengthsM: {
        mainLine: requirePosNum(len, 'mainLine', `${basePath}.defaultLengthsM`),
        radiatorBranch: requirePosNum(
          len,
          'radiatorBranch',
          `${basePath}.defaultLengthsM`,
        ),
        ufhCollectorBranch: requirePosNum(
          len,
          'ufhCollectorBranch',
          `${basePath}.defaultLengthsM`,
        ),
      },
      maxUfhLoopLengthM: requirePosNum(d, 'maxUfhLoopLengthM', basePath),
      ufhLoopDeltaTK: requirePosNum(d, 'ufhLoopDeltaTK', basePath),
      ufhLoopVelocityMinMps: requirePosNum(d, 'ufhLoopVelocityMinMps', basePath),
      ufhLoopVelocityMaxMps: requirePosNum(d, 'ufhLoopVelocityMaxMps', basePath),
      maxUfhLoopPressureDropKPa: requirePosNum(d, 'maxUfhLoopPressureDropKPa', basePath),
      ufhLoopMinNominalDiameterMm: requirePosNum(d, 'ufhLoopMinNominalDiameterMm', basePath),
      ufhParasiticDownTriggerWm2: requirePosNum(d, 'ufhParasiticDownTriggerWm2', basePath),
      ufhParasiticDownToUpRatio: (() => {
        const n = requirePosNum(d, 'ufhParasiticDownToUpRatio', basePath);
        if (n > 1) {
          throw new Error(`${basePath}.ufhParasiticDownToUpRatio: число ≤ 1`);
        }
        return n;
      })(),
      ufhLoopPipeResizeEnabled: (() => {
        if (typeof d.ufhLoopPipeResizeEnabled !== 'boolean') {
          throw new Error(`${basePath}.ufhLoopPipeResizeEnabled: ожидается boolean`);
        }
        return d.ufhLoopPipeResizeEnabled;
      })(),
      ufhLoopPressureUtilizationForResize: (() => {
        const n = requirePosNum(d, 'ufhLoopPressureUtilizationForResize', basePath);
        if (n > 1) {
          throw new Error(`${basePath}.ufhLoopPressureUtilizationForResize: число ≤ 1`);
        }
        return n;
      })(),
      roughnessMmByMaterial: Object.fromEntries(
        Object.entries(rough).map(([k, v]) => {
          const n = Number(v);
          if (!Number.isFinite(n) || n <= 0) {
            throw new Error(`${basePath}.roughnessMmByMaterial.${k}: число > 0`);
          }
          return [k, n];
        }),
      ),
      localLossZeta: {
        elbow90: requirePosNum(zeta, 'elbow90', `${basePath}.localLossZeta`),
        teeBranch: requirePosNum(zeta, 'teeBranch', `${basePath}.localLossZeta`),
        mixingNode: requirePosNum(zeta, 'mixingNode', `${basePath}.localLossZeta`),
        collector: requirePosNum(zeta, 'collector', `${basePath}.localLossZeta`),
      },
      pumpHeadMarginPercent: requirePosNum(d, 'pumpHeadMarginPercent', basePath),
      pumpDutyQMaxUtilizationPercent: (() => {
        const n = requirePosNum(d, 'pumpDutyQMaxUtilizationPercent', basePath);
        if (n > 100) {
          throw new Error(`${basePath}.pumpDutyQMaxUtilizationPercent: число ≤ 100`);
        }
        return n;
      })(),
      pumpMinHeadAtDutyM: requirePosNum(d, 'pumpMinHeadAtDutyM', basePath),
      pumpMaxHeadMarginPercent: requirePosNum(d, 'pumpMaxHeadMarginPercent', basePath),
      pumpMinHeadAtQMaxM: requirePosNum(d, 'pumpMinHeadAtQMaxM', basePath),
      primaryFlowMarginPercent: requirePosNum(d, 'primaryFlowMarginPercent', basePath),
      balancingValveKPaPerTurn: requirePosNum(d, 'balancingValveKPaPerTurn', basePath),
    };
    const mainTransitMin = rec.mainTransitMinInternalDiameterMm;
    const branchMin = rec.branchMinInternalDiameterMm;
    if (branchMin > mainTransitMin) {
      throw new Error(
        `${basePath}.branchMinInternalDiameterMm (${branchMin}) не может быть больше `
        + `mainTransitMinInternalDiameterMm (${mainTransitMin})`,
      );
    }
    return rec;
  }

  throw new Error(`appliances: неизвестный applianceKind «${kind}»`);
}

/**
 * @param {unknown} json — массив документов
 * @param {string} [source]
 * @returns {import('./types').AppliancesBundle}
 */
export function validateAndNormalizeAppliancesBundle(json, source = 'file') {
  if (!Array.isArray(json)) {
    throw new Error('appliances: ожидается массив документов');
  }
  /** @type {Partial<import('./types').AppliancesBundle['byKind']>} */
  const byKind = {};
  /** @type {Partial<Record<import('./types').ApplianceKind, number>>} */
  const schemaVersions = {};

  for (const item of json) {
    const rec = /** @type {import('./types').NormalizedApplianceRules} */ (
      validateAndNormalizeApplianceDoc(item)
    );
    byKind[rec.applianceKind] = rec;
    schemaVersions[rec.applianceKind] = rec.schemaVersion;
  }

  const required = /** @type {const} */ ([
    'indirect_water_heater',
    'boiler',
    'electric_storage',
    'radiator',
    'underfloor_heating',
    'hydraulics',
  ]);
  for (const k of required) {
    if (!byKind[k]) {
      throw new Error(`appliances: отсутствует обязательный документ applianceKind=${k}`);
    }
  }

  return {
    byKind: /** @type {import('./types').AppliancesBundle['byKind']} */ (byKind),
    schemaVersions,
    source,
  };
}
