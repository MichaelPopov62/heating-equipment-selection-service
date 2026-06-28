/**
 * Назначение: таблица гидравлики петель ТП в отчёте.
 */

import type { ParsedUfhLoopHydraulics } from '../../types/underfloorHeating';
import styles from './UfhLoopHydraulicsTable.module.css';

/** Пороги MVP (appliances.hydraulics) — для подсветки в UI. */
const UFH_LOOP_V_MIN_MPS = 0.2;
const UFH_LOOP_V_MAX_MPS = 0.7;
const UFH_LOOP_DP_MAX_KPA = 20;

type UfhLoopHydraulicsTableProps = {
  loopsCount: number;
  loops: ParsedUfhLoopHydraulics[];
  pipeResizeApplied?: boolean;
};

function resizeActionLabel(action: ParsedUfhLoopHydraulics['pipeResizeAction']): string {
  switch (action) {
    case 'upsized':
      return 'Увеличен Ø';
    case 'downsized':
      return 'Уменьшен Ø';
    case 'loops_adjusted':
      return 'Скорректировано число петель';
    default:
      return 'Без изменений';
  }
}

function velocityCellClass(velocityMps: number | null): string | undefined {
  if (velocityMps == null) return undefined;
  if (velocityMps < UFH_LOOP_V_MIN_MPS || velocityMps > UFH_LOOP_V_MAX_MPS) {
    return styles.outOfRange;
  }
  return undefined;
}

function pressureCellClass(pressureDropKPa: number | null): string | undefined {
  if (pressureDropKPa == null) return undefined;
  if (pressureDropKPa > UFH_LOOP_DP_MAX_KPA) {
    return styles.outOfRange;
  }
  return undefined;
}

export function UfhLoopHydraulicsTable({
  loopsCount,
  loops,
  pipeResizeApplied,
}: UfhLoopHydraulicsTableProps) {
  if (loops.length === 0) return null;

  return (
    <div className={styles.root}>
      <h5 className={styles.title}>
        Петли ТП — гидравлика ({loopsCount} {loopsCount === 1 ? 'контур' : 'контура'})
      </h5>
      {pipeResizeApplied && (
        <p className={styles.hint}>
          Подбор Ø и/или число петель скорректированы автоматически (v 0,2–0,7 м/с, Δp ≤ 20 кПа).
        </p>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Петля</th>
            <th>Длина</th>
            <th>Q</th>
            <th>Ø</th>
            <th>v</th>
            <th>Δp</th>
            <th>Оптимизация</th>
          </tr>
        </thead>
        <tbody>
          {loops.map((loop) => (
            <tr key={loop.loopId}>
              <td>{loop.loopId}</td>
              <td>
                {loop.lengthM.toFixed(1)} <span className={styles.unit}>м</span>
              </td>
              <td>
                {loop.flowRateM3PerHour.toFixed(3)} <span className={styles.unit}>м³/ч</span>
              </td>
              <td>
                {loop.internalDiameterMm != null
                  ? `${loop.internalDiameterMm.toFixed(1)} мм`
                  : '—'}
              </td>
              <td className={velocityCellClass(loop.velocityMps)}>
                {loop.velocityMps != null
                  ? `${loop.velocityMps.toFixed(2)} м/с`
                  : '—'}
              </td>
              <td className={pressureCellClass(loop.pressureDropKPa)}>
                {loop.pressureDropKPa != null
                  ? `${loop.pressureDropKPa.toFixed(1)} кПа`
                  : '—'}
              </td>
              <td>
                {resizeActionLabel(loop.pipeResizeAction)}
                {loop.pipeResizeReason && (
                  <span className={styles.reasonHint} title={loop.pipeResizeReason}>
                    {' '}
                    ⓘ
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loops.some((l) => l.warnings.length > 0) && (
        <ul className={styles.warnings}>
          {loops.flatMap((l) =>
            l.warnings.map((w, i) => (
              <li key={`${l.loopId}-w-${i}`}>{w}</li>
            )),
          )}
        </ul>
      )}
    </div>
  );
}
