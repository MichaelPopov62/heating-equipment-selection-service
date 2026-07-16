/**
 * Назначение: Форма шага «Водонагреватель».
 * Описание: Стратегия подбора БКН/ЭВН; полный отчёт matching — в модалке.
 */

import { useMemo, useState } from 'react';

import type { ObjectType } from '../../types/envelope';
import type { HotWaterBoilerPowerMatchingScheme } from '../../types/heatingMatching';
import type { HotWaterFormValue } from '../../types/hotWater';
import type { WaterHeaterFormValue } from '../../types/waterHeater';
import type { ParsedIndirectWaterHeaterMatching } from '../../utils/parseIndirectWaterHeaterMatchingFromReport';
import type { ParsedWaterHeaterMatching } from '../../utils/parseWaterHeaterMatchingFromReport';
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

      <p className={styles.hint}>
        Детали расчёта потребления (расход, мощность, объём бака) — на шаге
        «Горячая вода», кнопка «Отчёт по расчёту ГВ».
      </p>

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

      <div className={reportActionsStyles.reportActions}>
        <div className={reportActionsStyles.reportActionsRow}>
          <button
            type="button"
            className={reportActionsStyles.reportButton}
            disabled={!canOpenReport}
            onClick={() => { setReportOpen(true); }}
          >
            Отчёт по подбору водонагревателя
          </button>
          {onBackToResults != null && (
            <button
              type="button"
              className={reportActionsStyles.backButton}
              onClick={onBackToResults}
            >
              Назад к результатам
            </button>
          )}
        </div>
        {calcLoading && (
          <p className={styles.hint} style={{ marginTop: 8 }} role="status">
            Обновление подбора…
          </p>
        )}
        {!canOpenReport && !calcLoading && (
          <p className={styles.hint} style={{ marginTop: 8 }}>
            Отчёт появится после авторасчёта с выбранной схемой ГВС.
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
