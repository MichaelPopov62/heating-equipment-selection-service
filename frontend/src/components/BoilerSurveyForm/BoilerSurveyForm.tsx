/**
 * Призначення: форма кроку анкети «Котёл».
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
 * Крок «Котёл»: графік опалення та звіт підбору.
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
              Режим графика отопления (только тёплый пол)
            </p>
            <p className={styles.hint} role="status">
              Выбран режим «Отопление только теплым полом»: котёл работает на
              низкотемпературный контур <strong>40/30 °C</strong> (прямое
              подключение). Смесительный узел не требуется. Радиаторный график
              75/65 или 55/45 в этом режиме не применяется.
            </p>
          </>
        ) : (
          <>
            <label className={styles.fieldLabel} htmlFor="thermal-regime-preset">
              Режим графика отопления (подача / обратка, пресет под тип котла)
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
              Радиаторный контур: <strong>75/65</strong> (традиционный котёл) или{' '}
              <strong>55/45</strong> (конденсационный). Контур тёплого пола (45/35
              или 40/30) задаётся отдельно по финишу покрытия на шаге «Помещения».
              Подводка и тип приборов — шаг «Радиаторы». В API:{' '}
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
            Отчёт по подбору котла
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
            Обновление расчёта…
          </p>
        )}
        {!canOpenReport && !calcLoading && (
          <p className={styles.hint} style={{ marginTop: 8 }}>
            Отчёт появится после авторасчёта. Заполните помещения и ограждения,
            выберите сценарий ГВС на шаге «Водонагреватель».
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
