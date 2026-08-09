/**
 * Назначение: Форма шага «Водонагреватель».
 * Описание: Стратегия подбора БКН/ЭВН; полный отчёт matching — в модалке.
 */

import { useMemo, useState } from 'react';

import type { ObjectType } from '../../types/envelope';
import type { HotWaterBoilerPowerMatchingScheme } from '../../types/heatingMatching';
import type { HotWaterFormValue } from '../../types/hotWater';
import type { WaterHeaterFormValue } from '../../types/waterHeater';
import type { ParsedIndirectWaterHeaterMatching } from '../../utils/parsers/parseIndirectWaterHeaterMatchingFromReport';
import type { ParsedWaterHeaterMatching } from '../../utils/parsers/parseWaterHeaterMatchingFromReport';
import { getWaterHeaterSchemeOptions } from '../../utils/waterHeaterSchemeOptions';
import { validateWaterHeaterForm } from '../../utils/validateWaterHeaterForm';
import { shouldShowIndirectDhwSpaceCheckbox } from '../../../../shared/waterHeaterFormContract.js';
import { WaterHeaterReportDialog } from '../WaterHeaterReport/WaterHeaterReportDialog';
import { hasWaterHeaterReportContent } from '../WaterHeaterReport/hasWaterHeaterReportContent';
import reportActionsStyles from '../SurveyNavigation/SurveyReportActions.module.css';
import styles from './WaterHeaterForm.module.css';

type Props = {
  value: WaterHeaterFormValue;
  onChange: (next: WaterHeaterFormValue) => void;
  objectType: ObjectType;
  apartmentLarge: boolean;
  hotWaterForm: HotWaterFormValue;
  calcLoading: boolean;
  indirectMatching: ParsedIndirectWaterHeaterMatching | null;
  electricMatching: ParsedWaterHeaterMatching | null;
  /** Прокрутка к итогу ЭБ/БКН в сайдбаре «Результаты». */
  onBackToResults?: () => void;
};

export function WaterHeaterForm({
  value,
  onChange,
  objectType,
  apartmentLarge,
  hotWaterForm,
  calcLoading,
  indirectMatching,
  electricMatching,
  onBackToResults,
}: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const canOpenReport = hasWaterHeaterReportContent(
    indirectMatching,
    electricMatching,
  );

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
      <h2 className={styles.title}>Водонагрівач і сценарій ГВП</h2>
      <p className={styles.hint}>
        Оберіть, як забезпечується гаряча вода: через двоконтурний котел,
        бойлер непрямого нагріву (БКН) або електронакопичувач. Споживання води
        (мешканці, точки) задається на кроці «Гаряча вода»; тут — лише
        стратегія підбору обладнання.
      </p>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Сценарій зв&apos;язки котел / ГВП</h3>
        <label className={styles.label} htmlFor="water-heater-scheme">
          Як котел пов&apos;язаний із гарячою водою
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
          . Модель і об&apos;єм підбираються автоматично за розрахунком.
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
              Є техприміщення або ніша під бойлер непрямого нагріву (БКН).
              Без цієї позначки для квартири підбір БКН не виконується.
            </span>
          </label>
        )}
      </div>

      <p className={styles.hint}>
        Деталі розрахунку споживання (витрата, потужність, об&apos;єм бака) — на кроці
        «Гаряча вода», кнопка «Звіт з розрахунку ГВ».
      </p>

      {validation.warnings.length > 0 && (
        <div className={styles.warningsSection} role="status">
          <h3 className={styles.sectionTitle}>Підказки</h3>
          <ul className={styles.warningsList}>
            {validation.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={reportActionsStyles.reportActions}>
        <div className={reportActionsStyles.reportActionsRow}>
          <button
            type="button"
            className={reportActionsStyles.reportButton}
            disabled={!canOpenReport}
            onClick={() => { setReportOpen(true); }}
          >
            Звіт з підбору водонагрівача
          </button>
          {onBackToResults != null && (
            <button
              type="button"
              className={reportActionsStyles.backButton}
              onClick={onBackToResults}
            >
              Назад до результатів
            </button>
          )}
        </div>
        {calcLoading && (
          <p className={`${styles.hint} ${styles.hintMt8}`} role="status">
            Оновлення підбору…
          </p>
        )}
        {!canOpenReport && !calcLoading && (
          <p className={`${styles.hint} ${styles.hintMt8}`}>
            Звіт з&apos;явиться після авторозрахунку з обраною схемою ГВП.
          </p>
        )}
      </div>

      <WaterHeaterReportDialog
        open={reportOpen}
        onClose={() => { setReportOpen(false); }}
        indirect={indirectMatching}
        electric={electricMatching}
      />
    </div>
  );
}
