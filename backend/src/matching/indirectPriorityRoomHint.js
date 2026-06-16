/**
 * Назначение: предупреждение по приоритету ГВС.
 * Описание: при длительном нагреве БКН добавляет в отчёт hint о возможном остывании самого
 * нагруженного по ограждениям помещения.
 */

/**
 * @param {import('../types/shared-types').IndirectWaterHeaterMatchingReport | undefined} indirectReport
 * @param {import('../types/shared-types').HeatLossReport | undefined} heatLoss
 */
export function appendIndirectPriorityRoomWarnings(indirectReport, heatLoss) {
  if (
    !indirectReport
    || indirectReport.heatTimeMinutesFullTank == null
    || !heatLoss?.rooms?.length
  ) {
    return;
  }
  const t = indirectReport.heatTimeMinutesFullTank;
  if (t < 18) return;

  let worst = heatLoss.rooms[0];
  for (const r of heatLoss.rooms) {
    if ((r.envelopeWatts ?? 0) > (worst.envelopeWatts ?? 0)) worst = r;
  }
  const kw = (worst.envelopeWatts ?? 0) / 1000;
  const label = worst.name ?? worst.id ?? 'помещение';
  indirectReport.warnings.push(
    `При приоритете ГВС и длительном нагреве бака (~${t} мин) проверьте остывание самого нагруженного помещения по ограждениям («${label}», ~${kw.toFixed(2)} кВт); при необходимости увеличьте мощность котла или змеевик БКН.`,
  );
}
