/**
 * Назначение: Форма шага «Водонагреватель».
 * Описание: Стратегия подбора БКН/ЭВН, контекст потребления и превью результата API.
 */

import { useMemo } from 'react';

import type { ObjectType } from '../../types/envelope';
import type { HotWaterBoilerPowerMatchingScheme } from '../../types/heatingMatching';
import type { HotWaterFormValue } from '../../types/hotWater';
import type { WaterHeaterFormValue } from '../../types/waterHeater';
import type { ApiHotWater } from '../../types/recommendationsBlock';
import type { ParsedIndirectWaterHeaterMatching } from '../../utils/parseIndirectWaterHeaterMatchingFromReport';
import type { ParsedWaterHeaterMatching } from '../../utils/parseWaterHeaterMatchingFromReport';
import { formatLiters } from '../../utils/format';
import { getWaterHeaterSchemeOptions } from '../../utils/waterHeaterSchemeOptions';
import { validateWaterHeaterForm } from '../../utils/validateWaterHeaterForm';
import { shouldShowIndirectDhwSpaceCheckbox } from '../../../../shared/waterHeaterFormContract.js';
import { WaterHeaterMatchingPreview } from '../WaterHeaterMatchingPreview/WaterHeaterMatchingPreview';
import styles from './WaterHeaterForm.module.css';

type Props = {
  value: WaterHeaterFormValue;
  onChange: (next: WaterHeaterFormValue) => void;
  objectType: ObjectType;
  apartmentLarge: boolean;
  hotWaterForm: HotWaterFormValue;
  hotWaterReport: ApiHotWater;
  calcLoading: boolean;
  indirectMatching: ParsedIndirectWaterHeaterMatching | null;
  electricMatching: ParsedWaterHeaterMatching | null;
};

export function WaterHeaterForm({
  value,
  onChange,
  objectType,
  apartmentLarge,
  hotWaterForm,
  hotWaterReport,
  calcLoading,
  indirectMatching,
  electricMatching,
}: Props) {
  const schemeOptions = useMemo(
    () => getWaterHeaterSchemeOptions(objectType, apartmentLarge),
    [objectType, apartmentLarge],
  );

  const allowedSchemes = useMemo(
    () => schemeOptions.map((o) => o.value),
    [schemeOptions],
  );

  const validation = useMemo(
    () =>
      validateWaterHeaterForm(value, {
        objectType,
        hotWaterForm,
        allowedSchemes,
      }),
    [value, objectType, hotWaterForm, allowedSchemes],
  );

  const showIndirectCheckbox = shouldShowIndirectDhwSpaceCheckbox(
    objectType,
    value.hotWaterBoilerPowerMatchingScheme,
  );

  const dhwScenarioLabel =
    hotWaterReport?.dhwSupplyScenario === 'storage'
      ? 'Накопительный (дом): объём бака и мощность нагрева бака'
      : hotWaterReport?.dhwSupplyScenario === 'flowThrough'
        ? 'Проточный пик (квартира): мощность от расхода и ΔT'
        : objectType === 'house'
          ? 'Накопительный (ожидается для дома после расчёта)'
          : 'Проточный (ожидается для квартиры после расчёта)';

  const recommendedTankLabel =
    hotWaterReport?.recommendedTankLiters == null
      ? '— (отправьте расчёт)'
      : hotWaterReport.recommendedTankLiters === 0
        ? 'Не применяется (проточный сценарий)'
        : `${formatLiters(hotWaterReport.recommendedTankLiters)} л`;

  const handleSchemeChange = (scheme: HotWaterBoilerPowerMatchingScheme) => {
    const next: WaterHeaterFormValue = {
      ...value,
      hotWaterBoilerPowerMatchingScheme: scheme,
    };
    if (!shouldShowIndirectDhwSpaceCheckbox(objectType, scheme)) {
      next.indirectDhwSpaceAvailable = false;
    }
    onChange(next);
  };

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Водонагреватель и сценарий ГВС</h2>
      <p className={styles.hint}>
        Выберите, как обеспечивается горячая вода: через двухконтурный котёл,
        бойлер косвенного нагрева (БКН) или электронакопитель. Потребление воды
        (жильцы, точки) задаётся на шаге «Горячая вода»; здесь — только
        стратегия подбора оборудования.
      </p>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Сценарий связки котёл / ГВС</h3>
        <label className={styles.label} htmlFor="water-heater-scheme">
          Как котёл связан с горячей водой
        </label>
        <select
          id="water-heater-scheme"
          className={styles.select}
          value={value.hotWaterBoilerPowerMatchingScheme}
          onChange={(e) =>
            { handleSchemeChange(
              e.target.value as HotWaterBoilerPowerMatchingScheme,
            ); }
          }
        >
          {schemeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className={styles.hint}>
          В API:{' '}
          <code className={styles.inlineCode}>
            heatingSystem.hotWaterBoilerPowerMatchingScheme
          </code>
          . Модель и объём подбираются автоматически по расчёту.
        </p>

        {showIndirectCheckbox && (
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={value.indirectDhwSpaceAvailable}
              onChange={(e) =>
                { onChange({
                  ...value,
                  indirectDhwSpaceAvailable: e.target.checked,
                }); }
              }
            />
            <span>
              Есть техпомещение или ниша под бойлер косвенного нагрева (БКН).
              Без этой отметки для квартиры подбор БКН не выполняется.
            </span>
          </label>
        )}
      </div>

      <div className={styles.contextSection}>
        <h3 className={styles.sectionTitle}>Контекст расчёта</h3>
        <dl className={styles.contextDl}>
          <dt>Тип объекта</dt>
          <dd>{objectType === 'apartment' ? 'Квартира' : 'Дом'}</dd>
          <dt>Сценарий ГВС</dt>
          <dd>{dhwScenarioLabel}</dd>
          <dt>Рекомендуемый объём (расчёт ГВС)</dt>
          <dd
            className={
              hotWaterReport?.recommendedTankLiters != null &&
              hotWaterReport.recommendedTankLiters > 0
                ? styles.contextValueHighlight
                : undefined
            }
          >
            {recommendedTankLabel}
          </dd>
        </dl>
        <p className={styles.hint}>
          Жильцы, температура ГВС и точки водоразбора — на шаге «Горячая вода».
        </p>
      </div>

      {validation.warnings.length > 0 && (
        <div className={styles.warningsSection} role="status">
          <h3 className={styles.sectionTitle}>Подсказки</h3>
          <ul className={styles.warningsList}>
            {validation.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.previewSection}>
        <WaterHeaterMatchingPreview
          sectionTitle="Результат подбора"
          idPrefix="wh-form"
          indirect={indirectMatching}
          electric={electricMatching}
          calcLoading={calcLoading}
          showPendingHint
          variant="embedded"
        />
      </div>
    </div>
  );
}
