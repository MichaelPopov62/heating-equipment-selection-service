/**
 * Назначение: Полный отчёт расчёта ТП + подбор унибоксов.
 * Описание: Тело модалки шага «Тёплый пол»; детализация не дублируется в сайдбаре.
 */

import { useMemo, useState } from 'react';
import type { ParsedUnderfloorHeating, ParsedUfhResolutionStep } from '../../types/underfloorHeating';
import type { ParsedHydraulicsPumpProposal } from '../../types/hydraulics';
import type { ParsedUniboxesMatching } from '../../utils/parseUniboxesMatchingFromReport';
import {
  formatHeatFluxWm2,
  formatKw,
  formatTempC,
  formatWatts,
} from '../../utils/format';
import { selectUfhZonePumps } from '../../utils/ufhHydraulicsPumps';
import {
  collectCoverageLowWarnings,
  collectLowVelocityLoopWarnings,
  collectParasiticDownWarnings,
  collectSurfacePresetOverrideWarnings,
  filterGlobalWarningsExcludingStructured,
  filterRoomWarningsExcludingLoops,
  UFH_COVERAGE_LOW_CODES,
  UFH_COVERAGE_LOW_RESOLUTION_STEPS_FALLBACK,
  UFH_COVERAGE_LOW_UFH_ONLY_RESOLUTION_STEPS_FALLBACK,
  UFH_SURFACE_PRESET_OVERRIDE_CODES,
  UFH_WARN_COVERAGE_LOW_UFH_ONLY_CODE,
  UFH_WARN_LOW_VELOCITY_CODE,
  UFH_WARN_MIXING_NODE_CODE,
  UFH_WARN_PARASITIC_DOWN_CODE,
} from '../../utils/ufhWarningDisplay';
import { HydraulicsPumpCard } from '../HydraulicsProposal/HydraulicsPumpCard';
import { UfhMixingNodeSpecCard } from './UfhMixingNodeSpecCard';
import { UfhLoopHydraulicsTable } from './UfhLoopHydraulicsTable';
import { UniboxMatchingSection } from './UniboxMatchingSection';
import { UfhWarningResolutionDialog } from './UfhWarningResolutionDialog';
import styles from './UnderfloorHeatingReportView.module.css';

export type UnderfloorHeatingReportViewProps = {
  underfloorHeating: ParsedUnderfloorHeating;
  uniboxes?: ParsedUniboxesMatching | null;
  /** proposal.pumps из гидравлики — фильтруются до зон ТП. */
  hydraulicsPumps?: readonly ParsedHydraulicsPumpProposal[] | null;
};

type ResolutionDialogKind =
  | 'velocity'
  | 'parasitic'
  | 'mixing'
  | 'surfacePreset'
  | 'coverage'
  | null;

/**
 * @param props
 */
export function UnderfloorHeatingReportView({
  underfloorHeating,
  uniboxes = null,
  hydraulicsPumps = null,
}: UnderfloorHeatingReportViewProps) {
  const ufhPumps = selectUfhZonePumps(hydraulicsPumps);
  const [resolutionKind, setResolutionKind] = useState<ResolutionDialogKind>(null);

  const lowVelocityRec = useMemo(
    () =>
      underfloorHeating.resolvedRecommendations.find(
        (r) =>
          r.code === UFH_WARN_LOW_VELOCITY_CODE
          && r.resolutionSteps != null
          && r.resolutionSteps.length > 0,
      ) ?? null,
    [underfloorHeating.resolvedRecommendations],
  );

  const parasiticRec = useMemo(
    () =>
      underfloorHeating.resolvedRecommendations.find(
        (r) =>
          r.code === UFH_WARN_PARASITIC_DOWN_CODE
          && r.resolutionSteps != null
          && r.resolutionSteps.length > 0,
      ) ?? null,
    [underfloorHeating.resolvedRecommendations],
  );

  const mixingRec = useMemo(
    () =>
      underfloorHeating.resolvedRecommendations.find(
        (r) =>
          r.code === UFH_WARN_MIXING_NODE_CODE
          && r.resolutionSteps != null
          && r.resolutionSteps.length > 0,
      ) ?? null,
    [underfloorHeating.resolvedRecommendations],
  );

  const surfacePresetRec = useMemo(
    () =>
      underfloorHeating.resolvedRecommendations.find(
        (r) =>
          (UFH_SURFACE_PRESET_OVERRIDE_CODES as readonly string[]).includes(r.code)
          && r.resolutionSteps != null
          && r.resolutionSteps.length > 0,
      ) ?? null,
    [underfloorHeating.resolvedRecommendations],
  );

  const coverageRec = useMemo(
    () =>
      underfloorHeating.resolvedRecommendations.find((r) =>
        (UFH_COVERAGE_LOW_CODES as readonly string[]).includes(r.code),
      ) ?? null,
    [underfloorHeating.resolvedRecommendations],
  );

  const lowVelocityWarnings = useMemo(
    () => collectLowVelocityLoopWarnings(underfloorHeating.rooms),
    [underfloorHeating.rooms],
  );

  const parasiticWarnings = useMemo(
    () => collectParasiticDownWarnings(underfloorHeating.rooms),
    [underfloorHeating.rooms],
  );

  const surfacePresetWarnings = useMemo(
    () => collectSurfacePresetOverrideWarnings(underfloorHeating.rooms),
    [underfloorHeating.rooms],
  );

  const coverageWarnings = useMemo(
    () =>
      collectCoverageLowWarnings(
        underfloorHeating.rooms,
        underfloorHeating.resolvedRecommendations,
      ),
    [underfloorHeating.rooms, underfloorHeating.resolvedRecommendations],
  );

  const structuredOther = useMemo(
    () =>
      underfloorHeating.resolvedRecommendations.filter(
        (r) =>
          r.code !== UFH_WARN_LOW_VELOCITY_CODE
          && r.code !== UFH_WARN_PARASITIC_DOWN_CODE
          && r.code !== UFH_WARN_MIXING_NODE_CODE
          && !(UFH_SURFACE_PRESET_OVERRIDE_CODES as readonly string[]).includes(r.code)
          && !(UFH_COVERAGE_LOW_CODES as readonly string[]).includes(r.code),
      ),
    [underfloorHeating.resolvedRecommendations],
  );

  const structuredTexts = useMemo(
    () =>
      new Set(
        underfloorHeating.resolvedRecommendations.map((r) => r.text),
      ),
    [underfloorHeating.resolvedRecommendations],
  );

  const globalWarnings = useMemo(
    () =>
      filterGlobalWarningsExcludingStructured(
        underfloorHeating.warnings,
        structuredTexts,
      ),
    [underfloorHeating.warnings, structuredTexts],
  );

  const velocitySteps = lowVelocityRec?.resolutionSteps ?? [];
  const parasiticSteps = parasiticRec?.resolutionSteps ?? [];
  const mixingSteps = mixingRec?.resolutionSteps ?? [];
  const surfacePresetSteps = surfacePresetRec?.resolutionSteps ?? [];
  const coverageSteps: readonly ParsedUfhResolutionStep[] =
    coverageRec?.resolutionSteps != null && coverageRec.resolutionSteps.length > 0
      ? coverageRec.resolutionSteps
      : coverageRec?.code === UFH_WARN_COVERAGE_LOW_UFH_ONLY_CODE
        ? UFH_COVERAGE_LOW_UFH_ONLY_RESOLUTION_STEPS_FALLBACK
        : UFH_COVERAGE_LOW_RESOLUTION_STEPS_FALLBACK;
  const showVelocityResolve =
    lowVelocityWarnings.length > 0 && velocitySteps.length > 0;
  const showParasiticResolve =
    parasiticWarnings.length > 0 && parasiticSteps.length > 0;
  const showSurfacePresetResolve =
    surfacePresetWarnings.length > 0 && surfacePresetSteps.length > 0;
  /** Как у смесительного узла: при наличии WARN кнопка всегда (шаги из API или fallback). */
  const showCoverageResolve = coverageWarnings.length > 0;

  const dialogSteps: readonly ParsedUfhResolutionStep[] =
    resolutionKind === 'parasitic'
      ? parasiticSteps
      : resolutionKind === 'velocity'
        ? velocitySteps
        : resolutionKind === 'mixing'
          ? mixingSteps
          : resolutionKind === 'surfacePreset'
            ? surfacePresetSteps
            : resolutionKind === 'coverage'
              ? coverageSteps
              : [];

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
            : underfloorHeating.circuitSource === 'ufh_mode_preset'
              ? ' · смесительный узел не требуется (прямое подключение)'
              : ''}
        </p>
      )}

      {underfloorHeating.rooms.length > 0 && (
        <>
          {underfloorHeating.mixingNode != null && (
            <UfhMixingNodeSpecCard mixingNode={underfloorHeating.mixingNode} />
          )}

          {mixingRec != null && mixingSteps.length > 0 && (
            <div className={styles.velocityWarnBlock} role="status">
              <ul className={styles.warningsList}>
                <li>
                  <strong>{mixingRec.title}</strong>
                  {': '}
                  {mixingRec.text}
                </li>
              </ul>
              <button
                type="button"
                className={styles.resolveButton}
                onClick={() => {
                  setResolutionKind('mixing');
                }}
              >
                Устранение предупреждения
              </button>
            </div>
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

          {underfloorHeating.rooms.map((room) => {
            const roomWarnings = filterRoomWarningsExcludingLoops(room.warnings);
            return (
              <div key={room.roomId} className={styles.roomBlock}>
                <h4 className={styles.roomTitle}>{room.roomName}</h4>
                <dl className={styles.dl}>
                  <dt>Основа</dt>
                  <dd>{room.basePresetName}</dd>
                  <dt>Финиш</dt>
                  <dd>{room.finishMaterialName}</dd>
                  {(room.roomAreaM2 != null
                    || room.furnitureOccupiedAreaM2 != null
                    || room.heatedAreaM2 != null) && (
                    <>
                      <dt>Площади</dt>
                      <dd>
                        {room.roomAreaM2 != null && (
                          <>комната {room.roomAreaM2.toFixed(1)} м²</>
                        )}
                        {room.furnitureOccupiedAreaM2 != null
                          && room.furnitureOccupiedAreaM2 > 0 && (
                          <>
                            {room.roomAreaM2 != null ? ' · ' : ''}
                            мебель {room.furnitureOccupiedAreaM2.toFixed(1)} м²
                          </>
                        )}
                        {room.heatedAreaM2 != null && (
                          <>
                            {(room.roomAreaM2 != null
                              || (room.furnitureOccupiedAreaM2 != null
                                && room.furnitureOccupiedAreaM2 > 0))
                              ? ' · '
                              : ''}
                            активная {room.heatedAreaM2.toFixed(1)} м²
                          </>
                        )}
                      </dd>
                    </>
                  )}
                  <dt>Шаг трубы</dt>
                  <dd>
                    {room.pipeSpacingMm} мм
                    {room.requestedPipeSpacingMm != null
                      && room.resolvedPipeSpacingMm != null
                      && room.pipeSpacingResolution === 'tightened' && (
                        <span className={styles.muted}>
                          {' '}
                          (запрошено {room.requestedPipeSpacingMm} мм →{' '}
                          {room.resolvedPipeSpacingMm} мм)
                        </span>
                      )}
                  </dd>
                  {room.requiredHeatFluxUpWm2 != null && (
                    <>
                      <dt>Требуемый поток вверх</dt>
                      <dd>{formatHeatFluxWm2(room.requiredHeatFluxUpWm2)}</dd>
                    </>
                  )}
                  <dt>Поток вверх / вниз</dt>
                  <dd>
                    {formatHeatFluxWm2(room.heatFluxUpWm2)}
                    {' / '}
                    {formatHeatFluxWm2(room.heatFluxDownWm2)}
                    <span className={styles.muted}>
                      {' '}
                      (лимит {formatHeatFluxWm2(room.maxAllowableHeatFluxUpWm2)})
                    </span>
                  </dd>
                  <dt>Мощность вверх / вниз</dt>
                  <dd>
                    {formatWatts(room.heatFluxUpWatts)} / {formatWatts(room.heatFluxDownWatts)}
                  </dd>
                  <dt>Температура поверхности</dt>
                  <dd>
                    {formatTempC(room.surfaceTempC)}
                    <span className={styles.muted}>
                      {' '}
                      (макс. {formatTempC(room.maxSurfaceTemperatureCelsius)}
                      {room.comfortMaxSurfaceTemperatureCelsius != null
                        ? `, комфорт ${formatTempC(room.comfortMaxSurfaceTemperatureCelsius)}`
                        : ''}
                      )
                    </span>
                  </dd>
                  {(room.finishMaxSurfaceTemperatureCelsius != null
                    || room.presetMaxSurfaceTemperatureCelsius != null) && (
                    <>
                      <dt>Лимиты Tпов</dt>
                      <dd>
                        {room.finishMaxSurfaceTemperatureCelsius != null && (
                          <>финиш {formatTempC(room.finishMaxSurfaceTemperatureCelsius)}</>
                        )}
                        {room.presetMaxSurfaceTemperatureCelsius != null && (
                          <>
                            {room.finishMaxSurfaceTemperatureCelsius != null ? ' · ' : ''}
                            пресет режима{' '}
                            {formatTempC(room.presetMaxSurfaceTemperatureCelsius)}
                          </>
                        )}
                      </dd>
                    </>
                  )}
                  <dt>R покрытия / заделки</dt>
                  <dd>
                    {room.coveringResistanceM2KW.toFixed(3)} /{' '}
                    {room.pipeEmbedmentResistanceM2KW.toFixed(3)} м²·К/Вт
                  </dd>
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
                {roomWarnings.length > 0 && (
                  <ul className={styles.warningsList}>
                    {roomWarnings.map((w, i) => (
                      <li key={`ufh-room-${room.roomId}-${i}`}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {lowVelocityWarnings.length > 0 && (
            <div className={styles.velocityWarnBlock} role="status">
              <ul className={styles.warningsList}>
                {lowVelocityWarnings.map((w, i) => (
                  <li key={`ufh-v-low-${i}`}>{w}</li>
                ))}
              </ul>
              {showVelocityResolve && (
                <button
                  type="button"
                  className={styles.resolveButton}
                  onClick={() => {
                    setResolutionKind('velocity');
                  }}
                >
                  Устранение предупреждения
                </button>
              )}
            </div>
          )}

          {parasiticWarnings.length > 0 && (
            <div className={styles.velocityWarnBlock} role="status">
              <ul className={styles.warningsList}>
                {parasiticWarnings.map((w, i) => (
                  <li key={`ufh-parasitic-${i}`}>{w}</li>
                ))}
              </ul>
              {showParasiticResolve && (
                <button
                  type="button"
                  className={styles.resolveButton}
                  onClick={() => {
                    setResolutionKind('parasitic');
                  }}
                >
                  Устранение предупреждения
                </button>
              )}
            </div>
          )}

          {surfacePresetWarnings.length > 0 && (
            <div className={styles.velocityWarnBlock} role="status">
              <ul className={styles.warningsList}>
                {surfacePresetWarnings.map((w, i) => (
                  <li key={`ufh-surface-preset-${i}`}>{w}</li>
                ))}
              </ul>
              {showSurfacePresetResolve && (
                <button
                  type="button"
                  className={styles.resolveButton}
                  onClick={() => {
                    setResolutionKind('surfacePreset');
                  }}
                >
                  Устранение предупреждения
                </button>
              )}
            </div>
          )}

          {coverageWarnings.length > 0 && (
            <div className={styles.velocityWarnBlock} role="status">
              <ul className={styles.warningsList}>
                {coverageWarnings.map((w, i) => (
                  <li key={`ufh-coverage-${i}`}>{w}</li>
                ))}
              </ul>
              {showCoverageResolve && (
                <button
                  type="button"
                  className={styles.resolveButton}
                  onClick={() => {
                    setResolutionKind('coverage');
                  }}
                >
                  Устранение предупреждения
                </button>
              )}
            </div>
          )}
        </>
      )}

      {structuredOther.length > 0 && (
        <div className={styles.structuredBlock}>
          <h4 className={styles.roomTitle}>Рекомендации и предупреждения</h4>
          <ul className={styles.structuredList}>
            {structuredOther.map((rec, i) => (
              <li key={`ufh-rec-${rec.code}-${i}`} className={styles.structuredItem}>
                <div className={styles.structuredText}>
                  <strong>{rec.title}</strong>
                  <span>{rec.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {globalWarnings.length > 0 && (
        <ul className={styles.warningsList}>
          {globalWarnings.map((w, i) => (
            <li key={`ufh-global-${i}`}>{w}</li>
          ))}
        </ul>
      )}

      {uniboxes != null && (
        <UniboxMatchingSection matching={uniboxes} />
      )}

      <UfhWarningResolutionDialog
        open={resolutionKind != null}
        steps={dialogSteps}
        onClose={() => {
          setResolutionKind(null);
        }}
      />
    </div>
  );
}
