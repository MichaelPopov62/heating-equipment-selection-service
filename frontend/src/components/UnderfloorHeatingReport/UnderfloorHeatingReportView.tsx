/**
 * Назначение: Полный отчёт расчёта ТП + подбор унибоксов.
 * Описание: Тело модалки шага «Тёплый пол»; детализация не дублируется в сайдбаре.
 */

import type { ParsedUnderfloorHeating } from '../../types/underfloorHeating';
import type { ParsedHydraulicsPumpProposal } from '../../types/hydraulics';
import type { ParsedUniboxesMatching } from '../../utils/parseUniboxesMatchingFromReport';
import {
  formatHeatFluxWm2,
  formatKw,
  formatTempC,
  formatWatts,
} from '../../utils/format';
import { selectUfhZonePumps } from '../../utils/ufhHydraulicsPumps';
import { HydraulicsPumpCard } from '../HydraulicsProposal/HydraulicsPumpCard';
import { UfhMixingNodeSpecCard } from './UfhMixingNodeSpecCard';
import { UfhLoopHydraulicsTable } from './UfhLoopHydraulicsTable';
import { UniboxMatchingSection } from './UniboxMatchingSection';
import styles from './UnderfloorHeatingReportView.module.css';

export type UnderfloorHeatingReportViewProps = {
  underfloorHeating: ParsedUnderfloorHeating;
  uniboxes?: ParsedUniboxesMatching | null;
  /** proposal.pumps из гидравлики — фильтруются до зон ТП. */
  hydraulicsPumps?: readonly ParsedHydraulicsPumpProposal[] | null;
};

/**
 * @param props
 */
export function UnderfloorHeatingReportView({
  underfloorHeating,
  uniboxes = null,
  hydraulicsPumps = null,
}: UnderfloorHeatingReportViewProps) {
  const ufhPumps = selectUfhZonePumps(hydraulicsPumps);

  return (
    <div>
      {underfloorHeating.rooms.length === 0 ? (
        <p className={styles.hint}>
          Режим ТП включён в анкете, но нет комнат с включённым тёплым полом.
          На шаге «Помещения» отметьте «Тёплый пол в этом помещении» и задайте основу + финиш.
        </p>
      ) : (
        <p className={styles.hint}>
          Источник: расчёт API (warmFloorCalc) · контур{' '}
          {underfloorHeating.circuitSupplyC}/{underfloorHeating.circuitReturnC} °C
          {underfloorHeating.circuitSource === 'mixed_default'
            ? ' (типичный смесительный узел)'
            : underfloorHeating.circuitSource === 'finish_preset'
              ? ' (по финишу покрытия)'
              : underfloorHeating.circuitSource === 'ufh_mode_preset'
                ? ' (пресет режима ТП)'
                : ''}
          {underfloorHeating.isMixingNodeRequired
            ? ' · требуется смесительный узел'
            : ''}
        </p>
      )}

      {underfloorHeating.rooms.length > 0 && (
        <>
          {underfloorHeating.mixingNode != null && (
            <UfhMixingNodeSpecCard mixingNode={underfloorHeating.mixingNode} />
          )}

          <div className={styles.pumpBlock}>
            <h4 className={styles.roomTitle}>Насос контура ТП</h4>
            {underfloorHeating.isMixingNodeRequired ? (
              ufhPumps.length > 0 ? (
                ufhPumps.map((p) => (
                  <HydraulicsPumpCard key={p.zoneId} pump={p} />
                ))
              ) : (
                <p className={styles.hint}>
                  Смесительный узел требуется, но зональный насос контура ТП не
                  подобран — проверьте каталог насосов и warnings гидравлики.
                </p>
              )
            ) : (
              <p className={styles.hint}>
                Отдельный насос контура ТП не требуется — циркуляция обеспечивается
                насосом котла.
              </p>
            )}
          </div>

          {underfloorHeating.underfloorHydraulics != null && (
            <dl className={styles.dl} style={{ marginTop: 10 }}>
              <dt>Гидравлика контура ТП</dt>
              <dd>
                Δt = {underfloorHeating.underfloorHydraulics.deltaTK} K, расход{' '}
                {underfloorHeating.underfloorHydraulics.flowRateM3PerHour} м³/ч
              </dd>
            </dl>
          )}
          <dl className={styles.dl} style={{ marginTop: 10 }}>
            <dt>Суммарная отдача вверх</dt>
            <dd>
              {formatKw(underfloorHeating.totalHeatFluxUpWatts / 1000, 2)}{' '}
              <span>кВт</span>
              <span className={styles.muted}>
                {' '}
                ({formatWatts(underfloorHeating.totalHeatFluxUpWatts)} Вт)
              </span>
            </dd>
            <dt>Паразитный поток вниз</dt>
            <dd>
              {formatKw(underfloorHeating.totalHeatFluxDownWatts / 1000, 2)}{' '}
              <span>кВт</span>
              <span className={styles.muted}>
                {' '}
                ({formatWatts(underfloorHeating.totalHeatFluxDownWatts)} Вт)
              </span>
            </dd>
          </dl>

          {underfloorHeating.rooms.map((room) => (
            <div key={room.roomId} className={styles.roomBlock}>
              <h4 className={styles.roomTitle}>{room.roomName}</h4>
              <dl className={styles.dl}>
                <dt>Основа</dt>
                <dd>{room.basePresetName}</dd>
                <dt>Покрытие</dt>
                <dd>{room.finishMaterialName}</dd>
                {room.heatedAreaM2 != null && room.heatedAreaM2 > 0 && (
                  <>
                    <dt>S_акт (пол под ТП)</dt>
                    <dd>
                      {room.heatedAreaM2.toFixed(1)} <span>м²</span>
                      {room.furnitureOccupiedAreaM2 != null
                        && room.furnitureOccupiedAreaM2 > 0 && (
                          <span className={styles.muted}>
                            {' '}
                            (мебель {room.furnitureOccupiedAreaM2.toFixed(1)} м²
                            {room.roomAreaM2 != null
                              ? ` из ${room.roomAreaM2.toFixed(1)} м²`
                              : ''}
                            )
                          </span>
                        )}
                    </dd>
                  </>
                )}
                {room.requiredHeatFluxUpWm2 != null && room.requiredHeatFluxUpWm2 > 0 && (
                  <>
                    <dt>q_треб (на S_акт)</dt>
                    <dd>
                      {formatHeatFluxWm2(room.requiredHeatFluxUpWm2)}{' '}
                      <span>Вт/м²</span>
                    </dd>
                  </>
                )}
                <dt>Шаг укладки</dt>
                <dd>
                  {room.pipeSpacingMm} <span>мм</span>
                  {room.requestedPipeSpacingMm != null
                    && room.resolvedPipeSpacingMm != null
                    && room.requestedPipeSpacingMm !== room.resolvedPipeSpacingMm && (
                      <span className={styles.muted}>
                        {' '}
                        (запрошено {room.requestedPipeSpacingMm} мм)
                      </span>
                    )}
                  <span className={styles.muted}>
                    {' '}
                    (R_embed {room.pipeEmbedmentResistanceM2KW.toFixed(3)} м²·K/Вт)
                  </span>
                </dd>
                <dt>q↑ (в комнату)</dt>
                <dd>
                  {formatHeatFluxWm2(room.heatFluxUpWm2)} <span>Вт/м²</span> (
                  {formatWatts(room.heatFluxUpWatts)} Вт)
                </dd>
                <dt>q↓ (вниз)</dt>
                <dd>
                  {formatHeatFluxWm2(room.heatFluxDownWm2)} <span>Вт/м²</span> (
                  {formatWatts(room.heatFluxDownWatts)} Вт)
                </dd>
                <dt>T поверхности</dt>
                <dd
                  className={
                    room.surfaceTempC > room.maxSurfaceTemperatureCelsius
                    || (room.comfortMaxSurfaceTemperatureCelsius != null
                      && room.surfaceTempC > room.comfortMaxSurfaceTemperatureCelsius)
                      ? styles.alertValue
                      : undefined
                  }
                >
                  {formatTempC(room.surfaceTempC)} <span>°C</span>
                  <span className={styles.muted}>
                    {' '}
                    (
                    {room.presetMaxSurfaceTemperatureCelsius != null
                      ? `применённый лимит ${formatTempC(room.maxSurfaceTemperatureCelsius)} °C`
                      : `лимит материала ${formatTempC(room.maxSurfaceTemperatureCelsius)} °C`}
                    {room.finishMaxSurfaceTemperatureCelsius != null
                      && room.presetMaxSurfaceTemperatureCelsius != null
                      && room.finishMaxSurfaceTemperatureCelsius
                        > room.presetMaxSurfaceTemperatureCelsius
                      ? `, паспорт покрытия ${formatTempC(room.finishMaxSurfaceTemperatureCelsius)} °C`
                      : ''}
                    {room.comfortMaxSurfaceTemperatureCelsius != null
                      ? `, комфорт ${formatTempC(room.comfortMaxSurfaceTemperatureCelsius)} °C`
                      : ''}
                    )
                  </span>
                </dd>
                <dt>Rλ,B финиша</dt>
                <dd>
                  {room.finishCoveringResistanceM2KW.toFixed(4)}{' '}
                  <span>м²·K/Вт</span>
                </dd>
                <dt>Rλ,B (основа + финиш)</dt>
                <dd>
                  {room.coveringResistanceM2KW.toFixed(4)}{' '}
                  <span>м²·K/Вт</span>
                </dd>
                {room.maxAllowableHeatFluxUpWm2 > 0 && (
                  <>
                    <dt>q↑ допустимо при лимите T</dt>
                    <dd>
                      {formatHeatFluxWm2(room.maxAllowableHeatFluxUpWm2)}{' '}
                      <span>Вт/м²</span>
                    </dd>
                  </>
                )}
                {room.loopsCount != null && room.loopsCount > 0 && (
                  <>
                    <dt>Число петель ТП</dt>
                    <dd>{room.loopsCount}</dd>
                  </>
                )}
                {room.loops != null && room.loops.length > 0 && (
                  <>
                    <dt>Σ длина петель</dt>
                    <dd>
                      {room.loops
                        .reduce((sum, loop) => sum + loop.loopLengthM, 0)
                        .toFixed(1)}{' '}
                      <span>м</span>
                    </dd>
                  </>
                )}
              </dl>
              {room.loops != null && room.loops.length > 0 && (
                <UfhLoopHydraulicsTable
                  loopsCount={room.loopsCount ?? room.loops.length}
                  loops={room.loops}
                  {...(room.pipeResizeApplied !== undefined
                    ? { pipeResizeApplied: room.pipeResizeApplied }
                    : {})}
                />
              )}
              {room.warnings.length > 0 && (
                <ul className={styles.warningsList}>
                  {room.warnings.map((w, i) => (
                    <li key={`ufh-room-${room.roomId}-${i}`}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}

      {underfloorHeating.warnings.length > 0 && (
        <ul className={styles.warningsList}>
          {underfloorHeating.warnings.map((w, i) => (
            <li key={`ufh-global-${i}`}>{w}</li>
          ))}
        </ul>
      )}

      {uniboxes != null && (
        <UniboxMatchingSection matching={uniboxes} />
      )}
    </div>
  );
}
