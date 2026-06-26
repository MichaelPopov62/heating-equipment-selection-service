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
 * @param {import('../catalog/types').NormalizedCatalog['boilers']} boilers
 * @param {string | undefined} catalogBoilerId
 * @returns {import('../catalog/types').BoilerCatalogItemNormalized | null}
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
 * @param {object} args
 * @param {import('./types').HydraulicsCirculationZone} args.zone
 * @param {number} args.headRequiredM
 * @param {import('./types').HydraulicsPumpDutyRules} args.dutyRules
 * @param {Record<string, unknown> | null | undefined} args.boilerRecord
 * @param {import('../catalog/types').NormalizedCatalog['pumps']} args.catalogPumps
 * @returns {{ match: import('./types').HydraulicsResolvedPump | null; warnings: string[] }}
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

      if (evalResult.ok && evalResult.modeName != null && evalResult.headAtDesignM != null) {
        return {
          match: {
            ...base,
            pumpSource: 'boiler_builtin',
            catalogBoilerId:
              typeof boilerRecord?.id === 'string' ? boilerRecord.id : undefined,
            modeName: evalResult.modeName,
            headAtDesignM: evalResult.headAtDesignM,
            headMarginPercent: evalResult.headMarginPercent ?? 0,
            note: 'Используется встроенный насос котла.',
          },
          warnings,
        };
      }

      warnings.push(
        `[${zone.label}] Встроенный насос котла не перекрывает рабочую точку `
        + `(Q=${q} м³/ч, H=${round(h, 2)} м) — подбор из каталога.`,
      );
    }
  }

  const { pump, warnings: pickWarnings } = pickPumpForSystem({
    designFlowM3PerHour: q,
    headRequiredM: h,
    pumps: catalogPumps ?? [],
    dutyRules,
  });

  warnings.push(...pickWarnings.map((w) => `[${zone.label}] ${w}`));

  if (!pump) {
    return { match: null, warnings };
  }

  return {
    match: {
      ...base,
      pumpSource: 'catalog',
      catalogPumpId: pump.catalogPumpId,
      modeName: pump.modeName,
      headAtDesignM: pump.headAtDesignM,
      headMarginPercent: pump.headMarginPercent,
      warnings: pump.warnings,
    },
    warnings,
  };
}

/**
 * @param {import('./types').HydraulicsResolvedPump} resolved
 * @returns {import('./types').HydraulicsPumpMatch}
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
 * @param {import('./types').HydraulicsPipelineInput} args.dto
 * @param {import('./types').HydraulicsPressureReport} args.pressure
 * @param {import('../catalog/types').NormalizedCatalog} args.catalog
 * @returns {import('./types').HydraulicsSystemPumpsResult}
 */
export function resolveSystemPumps({ dto, pressure, catalog }) {
  const flows = resolveCirculationFlows(dto);
  const dutyRules = pumpDutyRulesFromHydraulicsRules(dto.rules);

  const boilerRecord = findBoilerInCatalog(
    catalog.boilers,
    dto.source.catalogBoilerId,
  );

  /** @type {import('./types').HydraulicsResolvedPump[]} */
  const pumps = [];
  /** @type {string[]} */
  const warnings = [...flows.warnings];
  /** @type {string[]} */
  const notes = [...flows.notes];

  for (const zone of flows.zones) {
    if (!zone.requiresCatalogPump) continue;

    const headRequiredM = resolveHeadForZone(zone.zoneId, pressure, dto);
    const { match, warnings: zoneWarnings } = resolvePumpForZone({
      zone,
      headRequiredM,
      dutyRules,
      boilerRecord: /** @type {Record<string, unknown> | null} */ (boilerRecord),
      catalogPumps: catalog.pumps,
    });
    warnings.push(...zoneWarnings);
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
    warnings,
    notes,
  };
}
