/**
 * Призначення: форма кроку анкети «Радіатори».
 * Опис: підводка, тип приладів; звіт розрахунку — у модалці (патерн ТП / ГВ / ВН).
 */

import { useState } from 'react';

import {
  isRadiatorConnection,
  RADIATOR_CONNECTION_SURVEY_UI_OPTIONS,
  type RadiatorConnection,
} from '../../types/radiatorConnection';
import {
  isRadiatorEmitterPreference,
  RADIATOR_EMITTER_PREFERENCE_SURVEY_UI_OPTIONS,
  type RadiatorEmitterPreference,
} from '../../types/radiatorEmitterPreference';
import type { ParsedRadiatorsMatching } from '../../utils/parseRadiatorsMatchingFromReport';
import { RadiatorsReportDialog } from '../RadiatorsReport/RadiatorsReportDialog';
import { hasRadiatorsReportContent } from '../RadiatorsReport/hasRadiatorsReportContent';
import reportActionsStyles from '../SurveyNavigation/SurveyReportActions.module.css';
import styles from './RadiatorsSurveyForm.module.css';

export type RadiatorsSurveyFormProps = {
  radiatorConnection: RadiatorConnection;
  radiatorEmitterPreference: RadiatorEmitterPreference;
  onConnectionChange: (connection: RadiatorConnection) => void;
  onPreferenceChange: (preference: RadiatorEmitterPreference) => void;
  /**
   * Якщо задано (режим ufh_only) — селекти disabled, значення в draft не скидаються.
   * Matching радіаторів на бекенді skip; поля все одно йдуть у heatingSystem з дефолтами.
   */
  radiatorsDisabledReason: string | null;
  radiatorsMatching: ParsedRadiatorsMatching | null;
  calcLoading?: boolean;
  /** Прокрутка до підсумку радіаторів у сайдбарі «Результати». */
  onBackToResults?: () => void;
};

/**
 * Крок «Радіатори»: підводка, тип приладів і звіт підбору.
 *
 * @param props
 */
export function RadiatorsSurveyForm({
  radiatorConnection,
  radiatorEmitterPreference,
  onConnectionChange,
  onPreferenceChange,
  radiatorsDisabledReason,
  radiatorsMatching,
  calcLoading = false,
  onBackToResults,
}: RadiatorsSurveyFormProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const disabled = radiatorsDisabledReason != null;
  const canOpenReport = hasRadiatorsReportContent(radiatorsMatching);

  return (
    <div className={styles.root}>
      {radiatorsDisabledReason != null && (
        <p className={styles.status} role="status">
          {radiatorsDisabledReason}
        </p>
      )}

      <div className={styles.fieldBlock}>
        <label className={styles.fieldLabel} htmlFor="radiator-connection">
          Подводка радиаторов
        </label>
        <select
          id="radiator-connection"
          className={styles.select}
          value={radiatorConnection}
          disabled={disabled}
          aria-disabled={disabled}
          onChange={(e) => {
            if (!isRadiatorConnection(e.target.value)) return;
            onConnectionChange(e.target.value);
          }}
        >
          {RADIATOR_CONNECTION_SURVEY_UI_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className={styles.hint}>
          Боковая — серии K/Klasik; нижняя — VK/VKP. Фильтрует панельный пул.
          Тип прибора на весь объект задаётся отдельно. В API:{' '}
          <code className={styles.inlineCode}>
            heatingSystem.radiatorConnection
          </code>
          .
        </p>
      </div>

      <div className={styles.fieldBlock}>
        <label
          className={styles.fieldLabel}
          htmlFor="radiator-emitter-preference"
        >
          Тип радиаторов на объект
        </label>
        <select
          id="radiator-emitter-preference"
          className={styles.select}
          value={radiatorEmitterPreference}
          disabled={disabled}
          aria-disabled={disabled}
          onChange={(e) => {
            if (!isRadiatorEmitterPreference(e.target.value)) return;
            onPreferenceChange(e.target.value);
          }}
        >
          {RADIATOR_EMITTER_PREFERENCE_SURVEY_UI_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className={styles.hint}>
          Один тип приборов на все помещения (секции или панели). Авто —
          Two-Pass по объекту. В API:{' '}
          <code className={styles.inlineCode}>
            heatingSystem.radiatorEmitterPreference
          </code>
          .
        </p>
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
            Отчёт по расчёту радиаторов
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
            Отчёт появится после авторасчёта. Заполните помещения и ограждения;
            при режиме «только тёплый пол» подбор радиаторов пропускается — в
            отчёте будет пояснение после ответа сервера.
          </p>
        )}
      </div>

      <RadiatorsReportDialog
        open={reportOpen}
        onClose={() => {
          setReportOpen(false);
        }}
        radiators={radiatorsMatching}
      />
    </div>
  );
}
