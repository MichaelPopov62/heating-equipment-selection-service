/**
 * Назначение: подбор насосов по зонам циркуляции.
 * Описание: Проверка встроенного насоса котла → каталог pumps; несколько зон (main + zone).
 */

import {
  evaluatePumpCurveAtDuty,
  pickPumpForSystem,
  pumpDutyRulesFromHydraulicsRules,
} from './pickPump.js';
import { resolveCirculationFlows } from './resolveCirculationFlows.js';
import { resolveHeadForZone } from './resolveZoneHead.js';
import { round } from '../utils/math.js';

/**
 * @param {import('../catalog/types.js').NormalizedCatalog['boilers']} boilers
 * @param {string | undefined} catalogBoilerId
 * @returns {import('../catalog/types.js').BoilerCatalogItemNormalized | null}
 */
function findBoilerInCatalog(boilers, catalogBoilerId) {
  if (!catalogBoilerId || !boilers) return null;
  const all = [
    ...(boilers.doubleCircuit ?? []),
    ...(boilers.singleCircuit ?? []),
  ];
  return all.find((b) => {
    const id = /** @type {{ id?: string }} */ (b).id;
    return id === catalogBoilerId || b.model === catalogBoilerId;
  }) ?? null;
}

/**
 * @param {Record<string, unknown> | null | undefined} boilerRecord
 * @returns {boolean}
 */
function isWallMountedBoiler(boilerRecord) {
  if (!boilerRecord) return false;
  const mt = boilerRecord.mountingType;
  if (mt === 'wall') return true;
  if (mt === 'floor') return false;
  const tags = boilerRecord.tags;
  if (Array.isArray(tags)) {
    if (tags.includes('wall-mounted')) return true;
    if (tags.includes('floor-standing')) return false;
  }
  return !!(/** @type {{ circulationPump?: unknown }} */ (boilerRecord).circulationPump);
}

/**
 * @param {object} args
 * @param {import('./types.js').HydraulicsCirculationZone} args.zone
 * @param {number} args.headRequiredM
 * @param {import('./types.js').HydraulicsPumpDutyRules} args.dutyRules
 * @param {Record<string, unknown> | null | undefined} args.boilerRecord
 * @param {import('../catalog/types.js').NormalizedCatalog['pumps']} args.catalogPumps
 * @returns {{
 *   match: import('./types.js').HydraulicsResolvedPump | null;
 *   warnings: string[];
 *   builtinPumpDuty?: import('./types.js').BuiltinPumpDutyReport;
 * }}
 */
function resolvePumpForZone({
  zone,
  headRequiredM,
  dutyRules,
  boilerRecord,
  catalogPumps,
}) {
  /** @type {string[]} */
  const warnings = [];
  const q = zone.designFlowM3PerHour;
  const h = headRequiredM;

  if (q <= 0 || h <= 0) {
    return {
      match: null,
      warnings: [`[${zone.label}] Насос не подобран: нулевой расход или напор.`],
    };
  }

  const base = {
    zoneId: zone.zoneId,
    zoneLabel: zone.label,
    pumpRole: zone.pumpRole,
    designFlowM3PerHour: q,
    headRequiredM: round(h, 2),
    warnings: [],
  };

  /** @type {import('./types.js').BuiltinPumpDutyReport | undefined} */
  let builtinPumpDuty;

  if (zone.pumpRole === 'main') {
    const builtinModes = /** @type {{ operatingModes?: unknown[] } | undefined} */ (
      boilerRecord?.circulationPump
    )?.operatingModes;

    if (Array.isArray(builtinModes) && builtinModes.length > 0) {
      const evalResult = evaluatePumpCurveAtDuty({
        operatingModes: /** @type {Array<{ modeName: string; qMinM3h?: number; qMaxM3h?: number; coefficients: object }>} */ (
          builtinModes
        ),
        designFlowM3PerHour: q,
        headRequiredM: h,
        dutyRules,
      });

      const boilerModel = typeof boilerRecord?.model === 'string' ? boilerRecord.model : undefined;
      const boilerId = typeof boilerRecord?.id === 'string' ? boilerRecord.id : undefined;

      if (evalResult.heatingCircuitMinFlowM3h != null && evalResult.builtinPumpRecognized) {
        builtinPumpDuty = {
          status: evalResult.ok ? 'ok' : (evalResult.dutyStatus ?? 'no_suitable_mode'),
          heatingCircuitMinFlowM3h: evalResult.heatingCircuitMinFlowM3h,
          ...(boilerId ? { catalogBoilerId: boilerId } : {}),
          ...(boilerModel ? { catalogBoilerModel: boilerModel } : {}),
          designFlowM3PerHour: q,
          headRequiredM: round(h, 2),
        };
      }

      if (evalResult.ok && evalResult.modeName != null && evalResult.headAtDesignM != null) {
        return {
          match: {
            ...base,
            pumpSource: 'boiler_builtin',
            ...(boilerId !== undefined ? { catalogBoilerId: boilerId } : {}),
            modeName: evalResult.modeName,
            headAtDesignM: evalResult.headAtDesignM,
            headMarginPercent: evalResult.headMarginPercent ?? 0,
            note: 'Используется встроенный насос котла.',
          },
          warnings,
          ...(builtinPumpDuty !== undefined ? { builtinPumpDuty } : {}),
        };
      }

      if (evalResult.dutyStatus === 'below_manufacturer_qmin') {
        const qMin = evalResult.heatingCircuitMinFlowM3h ?? 0;
        warnings.push(
          `[${zone.label}] Расход Q=${q} м³/ч ниже заводского минимума встроенного насоса `
          + `(q_min=${qMin} м³/ч) — риск тактования и перегрева теплообменника.`,
        );
        if (isWallMountedBoiler(boilerRecord)) {
          return {
            match: null,
            warnings,
            ...(builtinPumpDuty !== undefined ? { builtinPumpDuty } : {}),
          };
        }
      } else {
        warnings.push(
          `[${zone.label}] Встроенный насос котла не перекрывает рабочую точку `
          + `(Q=${q} м³/ч, H=${round(h, 2)} м) — подбор из каталога.`,
        );
      }
    }
  }

  const isZonePump = zone.pumpRole === 'zone';
  const { pump, warnings: pickWarnings } = pickPumpForSystem({
    designFlowM3PerHour: q,
    headRequiredM: h,
    pumps: catalogPumps ?? [],
    dutyRules,
    softQMin: isZonePump,
    skipHeadOversizedCheck: isZonePump,
    useExactHeadRequired: isZonePump,
  });

  warnings.push(...pickWarnings.map((w) => `[${zone.label}] ${w}`));

  if (!pump) {
    return {
      match: null,
      warnings,
      ...(builtinPumpDuty !== undefined ? { builtinPumpDuty } : {}),
    };
  }

  return {
    match: {
      ...base,
      pumpSource: 'catalog',
      ...(pump.catalogPumpId !== undefined
        ? { catalogPumpId: pump.catalogPumpId }
        : {}),
      modeName: pump.modeName,
      headAtDesignM: pump.headAtDesignM,
      headMarginPercent: pump.headMarginPercent,
      warnings: pump.warnings,
      ...(zone.pumpRole === 'main'
        ? { note: 'Доп. насос на котловую ветку (встроенный слаб).' }
        : {}),
    },
    warnings,
    ...(builtinPumpDuty !== undefined ? { builtinPumpDuty } : {}),
  };
}

/**
 * @param {import('./types.js').HydraulicsResolvedPump} resolved
 * @returns {import('./types.js').HydraulicsPumpMatch}
 */
function toLegacyPumpMatch(resolved) {
  return {
    zoneId: resolved.zoneId,
    zoneLabel: resolved.zoneLabel,
    pumpRole: resolved.pumpRole,
    pumpSource: resolved.pumpSource,
    ...(resolved.catalogPumpId ? { catalogPumpId: resolved.catalogPumpId } : {}),
    ...(resolved.catalogBoilerId ? { catalogBoilerId: resolved.catalogBoilerId } : {}),
    modeName: resolved.modeName,
    headMarginPercent: resolved.headMarginPercent,
    designFlowM3PerHour: resolved.designFlowM3PerHour,
    headRequiredM: resolved.headRequiredM,
    headAtDesignM: resolved.headAtDesignM,
    ...(resolved.note ? { note: resolved.note } : {}),
    warnings: resolved.warnings,
  };
}

/**
 * @param {object} args
 * @param {import('./types.js').HydraulicsPipelineInput} args.dto
 * @param {import('./types.js').HydraulicsPressureReport} args.pressure
 * @param {import('../catalog/types.js').NormalizedCatalog} args.catalog
 * @returns {import('./types.js').HydraulicsSystemPumpsResult}
 */
export function resolveSystemPumps({ dto, pressure, catalog }) {
  const flows = resolveCirculationFlows(dto);
  const dutyRules = pumpDutyRulesFromHydraulicsRules(dto.rules);

  const boilerRecord = findBoilerInCatalog(
    catalog.boilers,
    dto.source.catalogBoilerId,
  );

  /** @type {import('./types.js').HydraulicsResolvedPump[]} */
  const pumps = [];
  /** @type {string[]} */
  const warnings = [...flows.warnings];
  /** @type {string[]} */
  const notes = [...flows.notes];
  /** @type {import('./types.js').BuiltinPumpDutyReport | undefined} */
  let builtinPumpDuty;

  for (const zone of flows.zones) {
    if (!zone.requiresCatalogPump) continue;

    const headRequiredM = resolveHeadForZone(zone.zoneId, pressure, dto);
    const { match, warnings: zoneWarnings, builtinPumpDuty: zoneBuiltin } = resolvePumpForZone({
      zone,
      headRequiredM,
      dutyRules,
      boilerRecord: /** @type {Record<string, unknown> | null} */ (boilerRecord),
      catalogPumps: catalog.pumps,
    });
    warnings.push(...zoneWarnings);
    if (zoneBuiltin) {
      builtinPumpDuty = zoneBuiltin;
    }
    if (match) {
      pumps.push(match);
      if (match.note) notes.push(`[${match.zoneLabel}] ${match.note}`);
    }
  }

  const mainResolved = pumps.find((p) => p.zoneId === 'boiler_primary') ?? pumps[0];

  return {
    circulationZones: flows.zones,
    topology: flows.topology,
    boilerPumpDesignFlowM3PerHour: flows.boilerPumpDesignFlowM3PerHour,
    primaryMainLineFlowM3PerHour: flows.primaryMainLineFlowM3PerHour,
    pumps,
    ...(mainResolved ? { pump: toLegacyPumpMatch(mainResolved) } : {}),
    ...(builtinPumpDuty ? { builtinPumpDuty } : {}),
    warnings,
    notes,
  };
}
