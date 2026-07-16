/**
 * Назначение: Хук разбора JSON-отчёта расчёта.
 * Описание: Парсинг узлов matching, heatLoss и рекомендаций в стабильный объект для UI.
 */

import { useMemo } from 'react';
import type { CalcReportJson } from '../types/calcApi';
import type { HotWaterBoilerPowerMatchingScheme } from '../types/heatingMatching';
import type { ApiHotWater } from '../types/recommendationsBlock';
import { parseHotWaterFromReport } from '../utils/parseHotWaterFromReport';
import { heatLossReserveKw, heatLossTotalKw, wattsToKilowatts } from '../utils/calculators/heatLoss';
import { isRecord, readRecordField } from '../utils/jsonGuards';
import { parseBoilerFromReport } from '../utils/parsers/parseBoilerFromReport';
import { parseIndirectWaterHeaterMatchingFromReport } from '../utils/parseIndirectWaterHeaterMatchingFromReport';
import { parseRadiatorsMatchingFromReport, formatRadiatorsEmittersSummaryLabel } from '../utils/parseRadiatorsMatchingFromReport';
import { parseWaterHeaterMatchingFromReport } from '../utils/parseWaterHeaterMatchingFromReport';
import { parseUnderfloorHeatingFromReport } from '../utils/parseUnderfloorHeatingFromReport';
import { parseHydraulicsFromReport } from '../utils/parseHydraulicsFromReport';
import { parseUniboxesMatchingFromReport } from '../utils/parseUniboxesMatchingFromReport';

type IsCalcMatchingScheme = (v: string) => v is HotWaterBoilerPowerMatchingScheme;

/**
 * Парсить всі секції звіту POST /api/v1/calc.
 * Повертає стабільний об'єкт — усі поля null, поки звіт відсутній.
 */
export function useCalcReport(
  calcReport: CalcReportJson | null,
  isCalcMatchingScheme: IsCalcMatchingScheme,
  quickEstimateRadiatorsSections: number,
) {
  const apiHeatLoss = useMemo(() => {
    if (calcReport === null) return null;
    const calculations = readRecordField(calcReport, 'calculations');
    if (!calculations) return null;
    const heatLoss = readRecordField(calculations, 'heatLoss');
    if (!heatLoss) return null;
    const totalWatts = heatLoss.totalWatts;
    if (typeof totalWatts !== 'number' || !Number.isFinite(totalWatts)) return null;
    const heatLossKw = wattsToKilowatts(totalWatts);
    return {
      heatLossKw,
      reserveKw: heatLossReserveKw(heatLossKw),
      totalHeatKw: heatLossTotalKw(heatLossKw),
    };
  }, [calcReport]);

  const apiHotWaterFromReport = useMemo((): ApiHotWater => {
    return parseHotWaterFromReport(calcReport);
  }, [calcReport]);

  const apiBoilerFromReport = useMemo(
    () => parseBoilerFromReport(calcReport, isCalcMatchingScheme),
    [calcReport, isCalcMatchingScheme],
  );

  const apiRadiatorsFromReport = useMemo(
    () => parseRadiatorsMatchingFromReport(calcReport),
    [calcReport],
  );

  const apiIndirectWhFromReport = useMemo(
    () => parseIndirectWaterHeaterMatchingFromReport(calcReport),
    [calcReport],
  );

  const apiElectricWhFromReport = useMemo(
    () => parseWaterHeaterMatchingFromReport(calcReport),
    [calcReport],
  );

  const displayedRadiatorSectionsTotal = useMemo(() => {
    const ecoLabel = formatRadiatorsEmittersSummaryLabel(
      apiRadiatorsFromReport?.lineEconomy?.emittersSummary,
    );
    const effLabel = formatRadiatorsEmittersSummaryLabel(
      apiRadiatorsFromReport?.lineEfficient?.emittersSummary,
    );
    if (ecoLabel != null && effLabel != null) {
      return `эконом: ${ecoLabel} / эффективный: ${effLabel}`;
    }
    const primaryLabel = formatRadiatorsEmittersSummaryLabel(
      apiRadiatorsFromReport?.emittersSummary,
    );
    if (primaryLabel != null) return primaryLabel;
    if (
      apiRadiatorsFromReport?.totalSections != null
      && apiRadiatorsFromReport.byRoom.length > 0
    ) {
      return `${apiRadiatorsFromReport.totalSections} сек.`;
    }
    return String(quickEstimateRadiatorsSections);
  }, [apiRadiatorsFromReport, quickEstimateRadiatorsSections]);

  const apiCatalogSource = useMemo((): 'file' | 'mongo' | null => {
    if (calcReport === null) return null;
    const meta = readRecordField(calcReport, 'meta');
    if (!meta) return null;
    const s = meta.catalogSource;
    return s === 'mongo' || s === 'file' ? s : null;
  }, [calcReport]);

  const apiAutomationHints = useMemo(() => {
    if (calcReport === null) return [];
    const meta = readRecordField(calcReport, 'meta');
    if (!meta) return [];
    const raw = meta.automationHints;
    if (!Array.isArray(raw)) return [];
    const out: { type: string; message: string; suggestedScheme?: HotWaterBoilerPowerMatchingScheme }[] = [];
    for (const item of raw) {
      if (!isRecord(item)) continue;
      const message = typeof item.message === 'string' ? item.message : '';
      const type = typeof item.type === 'string' ? item.type : '';
      if (!message) continue;
      const ss = item.suggestedScheme;
      const suggestedScheme =
        typeof ss === 'string' && isCalcMatchingScheme(ss) ? ss : undefined;
      out.push({
        type,
        message,
        ...(suggestedScheme !== undefined ? { suggestedScheme } : {}),
      });
    }
    return out;
  }, [calcReport, isCalcMatchingScheme]);

  const apiBoilerKw = apiBoilerFromReport?.summary?.requiredKw ?? null;

  const apiUnderfloorHeatingFromReport = useMemo(
    () => parseUnderfloorHeatingFromReport(calcReport),
    [calcReport],
  );

  const apiUniboxesFromReport = useMemo(
    () => parseUniboxesMatchingFromReport(calcReport),
    [calcReport],
  );

  const apiHydraulicsFromReport = useMemo(
    () => parseHydraulicsFromReport(calcReport),
    [calcReport],
  );

  return {
    apiHeatLoss,
    apiHotWaterFromReport,
    apiBoilerFromReport,
    apiBoilerKw,
    apiRadiatorsFromReport,
    apiIndirectWhFromReport,
    apiElectricWhFromReport,
    apiUnderfloorHeatingFromReport,
    apiUniboxesFromReport,
    apiHydraulicsFromReport,
    displayedRadiatorSectionsTotal,
    apiCatalogSource,
    apiAutomationHints,
  };
}
