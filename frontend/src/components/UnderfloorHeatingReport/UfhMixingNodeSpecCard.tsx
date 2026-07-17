/**
 * Назначение: карточка спецификации смесительного узла ТП.
 * Описание: Q, H, Kvs из report.calculations.underfloorHeating.mixingNode.
 */

import type { ParsedUfhMixingNodeSpec } from '../../types/underfloorHeating';
import { UFH_DISTRIBUTION_PRESET_LABELS } from '../../types/ufhDistribution';
import styles from './UfhMixingNodeSpecCard.module.css';

type Props = {
  mixingNode: ParsedUfhMixingNodeSpec;
};

/** Спецификация насосно-смесительного узла контура ТП. */
export function UfhMixingNodeSpecCard({ mixingNode }: Props) {
  const distributionLabel =
    mixingNode.distributionPreset != null
      ? UFH_DISTRIBUTION_PRESET_LABELS[mixingNode.distributionPreset]
      : null;

  return (
    <div className={styles.root} role="region" aria-label="Смесительный узел ТП">
      <h4 className={styles.title}>Смесительный узел</h4>
      <dl className={styles.dl}>
        {mixingNode.boilerSupplyC != null && mixingNode.floorCircuitSupplyC != null && (
          <>
            <dt>Котёл → пол</dt>
            <dd>
              {mixingNode.boilerSupplyC} °C → {mixingNode.floorCircuitSupplyC} °C
            </dd>
          </>
        )}
        {distributionLabel != null && (
          <>
            <dt>Схема распределения</dt>
            <dd>{distributionLabel}</dd>
          </>
        )}
        {mixingNode.flowRateM3PerHour != null && (
          <>
            <dt>Расход контура</dt>
            <dd>
              {mixingNode.flowRateM3PerHour} <span>м³/ч</span>
              {mixingNode.deltaTK != null && (
                <span className={styles.muted}> (Δt = {mixingNode.deltaTK} K)</span>
              )}
            </dd>
          </>
        )}
        {mixingNode.headMetersMin != null && (
          <>
            <dt>Напор насоса (мин.)</dt>
            <dd>
              {mixingNode.headMetersMin} <span>м.в.ст.</span>
            </dd>
          </>
        )}
        {mixingNode.valveKvsMin != null && (
          <>
            <dt>Kvs клапана (мин.)</dt>
            <dd>
              {mixingNode.valveKvsMin} <span>м³/ч</span>
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
