/**
 * Назначение: блок отчёта calculations.hydraulics + matching.hydraulics.
 */

import styles from './HydraulicsReportCard.module.css';

type HydraulicsReportCardProps = {
  hydraulics: Record<string, unknown> | null | undefined;
  matchingHydraulics: Record<string, unknown> | null | undefined;
};

export function HydraulicsReportCard({
  hydraulics,
  matchingHydraulics,
}: HydraulicsReportCardProps) {
  if (!hydraulics) return null;

  const flow = hydraulics.flowRateM3PerHour;
  const head = (hydraulics.pressure as { headRequiredM?: number } | undefined)
    ?.headRequiredM;
  const pipes = Array.isArray(matchingHydraulics?.pipes)
    ? matchingHydraulics.pipes
    : [];
  const pump = matchingHydraulics?.pump as
    | { catalogPumpId?: string; modeName?: string; headAtDesignM?: number }
    | undefined;

  return (
    <div className={styles.root}>
      <h3>Гидравлика</h3>
      {flow != null && (
        <p>
          Расход контура: <strong>{String(flow)}</strong> м³/ч
        </p>
      )}
      {head != null && (
        <p>
          Требуемый напор: <strong>{String(head)}</strong> м
        </p>
      )}
      {pipes.length > 0 && (
        <p>
          Подобрано участков труб: <strong>{pipes.length}</strong>
        </p>
      )}
      {pump?.catalogPumpId && (
        <p>
          Насос: <strong>{pump.catalogPumpId}</strong>
          {pump.modeName ? ` (${pump.modeName})` : ''}
          {pump.headAtDesignM != null ? `, H≈${pump.headAtDesignM} м` : ''}
        </p>
      )}
    </div>
  );
}
