/**
 * Призначення: форма кроку анкети «Котел».
 * Опис: thermalRegimePreset + звіт підбору (патерн RadiatorsSurveyForm).
 */

import { useState } from 'react';

import type { ObjectType } from '../../types/envelope';
import {
  HEATING_THERMAL_REGIME_OPTIONS,
  type HeatingThermalRegimePreset,
} from '../../types/heatingThermalRegime';
import type { ParsedBoilerMatching } from '../../utils/parsers/parseBoilerFromReport';
import { BoilerReportDialog } from '../BoilerReport/BoilerReportDialog';
import { hasBoilerReportContent } from '../BoilerReport/hasBoilerReportContent';
import reportActionsStyles from '../SurveyNavigation/SurveyReportActions.module.css';
import styles from './BoilerSurveyForm.module.css';

export type BoilerSurveyFormProps = {
  thermalRegimePreset: HeatingThermalRegimePreset;
  onThermalRegimeChange: (preset: HeatingThermalRegimePreset) => void;
  thermalRegimeRecommendationHintText: string | null;
  /** Режим «только тёплый пол»: график котла фиксирован 40/30, select радиаторов скрыт. */
  ufhOnlyMode?: boolean;
  boilerMatching: ParsedBoilerMatching | null;
  objectType: ObjectType;
  catalogSource?: 'file' | 'mongo' | null;
  calcLoading?: boolean;
  onBackToResults?: () => void;
};

/**
 * Крок «Котел»: графік опалення та звіт підбору.
 *
 * @param props
 */
export function BoilerSurveyForm({
  thermalRegimePreset,
  onThermalRegimeChange,
  thermalRegimeRecommendationHintText,
  ufhOnlyMode = false,
  boilerMatching,
  objectType,
  catalogSource = null,
  calcLoading = false,
  onBackToResults,
}: BoilerSurveyFormProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const canOpenReport = hasBoilerReportContent(boilerMatching);

  return (
    <div className={styles.root}>
      <div className={styles.fieldBlock}>
        {ufhOnlyMode ? (
          <>
            <p className={styles.fieldLabel}>
              Режим графіка опалення (лише тепла підлога)
            </p>
            <p className={styles.hint} role="status">
              Обрано режим «Опалення лише теплою підлогою»: котел працює на
              низькотемпературний контур <strong>40/30 °C</strong> (пряме
              підключення). Змішувальний вузол не потрібен. Радіаторний графік
              75/65 або 55/45 у цьому режимі не застосовується.
            </p>
          </>
        ) : (
          <>
            <label className={styles.fieldLabel} htmlFor="thermal-regime-preset">
              Режим графіка опалення (подача / зворот, пресет під тип котла)
            </label>
            <select
              id="thermal-regime-preset"
              className={styles.select}
              value={thermalRegimePreset}
              onChange={(e) => {
                onThermalRegimeChange(e.target.value as HeatingThermalRegimePreset);
              }}
            >
              {HEATING_THERMAL_REGIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {thermalRegimeRecommendationHintText != null && (
              <p className={styles.hint} role="status">
                {thermalRegimeRecommendationHintText}
              </p>
            )}
            <p className={styles.hint}>
              Радіаторний контур: <strong>75/65</strong> (традиційний котел) або{' '}
              <strong>55/45</strong> (конденсаційний). Контур теплої підлоги (45/35
              або 40/30) задається окремо за фінішним покриттям на кроці «Приміщення».
              Підводка та тип приладів — крок «Радіатори». В API:{' '}
              <code className={styles.inlineCode}>
                heatingSystem.thermalRegimePreset
              </code>
              .
            </p>
          </>
        )}
      </div>

      <div className={reportActionsStyles.reportActions}>
        <div className={reportActionsStyles.reportActionsRow}>
          <button
            type="button"
            className={reportActionsStyles.reportButton}
            disabled={!canOpenReport}
            onClick={() => {
              setReportOpen(true);
            }}
          >
            Звіт з підбору котла
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
            Оновлення розрахунку…
          </p>
        )}
        {!canOpenReport && !calcLoading && (
          <p className={`${styles.hint} ${styles.hintMt8}`}>
            Звіт з&apos;явиться після авторозрахунку. Заповніть приміщення та огородження,
            оберіть сценарій ГВП на кроці «Водонагрівач».
          </p>
        )}
      </div>

      <BoilerReportDialog
        open={reportOpen}
        onClose={() => {
          setReportOpen(false);
        }}
        boiler={boilerMatching}
        objectType={objectType}
        catalogSource={catalogSource}
      />
    </div>
  );
}
