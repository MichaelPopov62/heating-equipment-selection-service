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
          Підводка радіаторів
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
          Бокова — серії K/Klasik; нижня — VK/VKP. Фільтрує панельний пул.
          Тип приладу на весь об&apos;єкт задається окремо. В API:{' '}
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
          Тип радіаторів на об&apos;єкт
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
          Один тип приладів на всі приміщення (секції або панелі). Авто —
          Two-Pass по об&apos;єкту. В API:{' '}
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
            Звіт з розрахунку радіаторів
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
          <p className={styles.hint} style={{ marginTop: 8 }} role="status">
            Оновлення розрахунку…
          </p>
        )}
        {!canOpenReport && !calcLoading && (
          <p className={styles.hint} style={{ marginTop: 8 }}>
            Звіт з&apos;явиться після авторозрахунку. Заповніть приміщення та огородження;
            у режимі «лише тепла підлога» підбір радіаторів пропускається — у
            звіті буде пояснення після відповіді сервера.
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
