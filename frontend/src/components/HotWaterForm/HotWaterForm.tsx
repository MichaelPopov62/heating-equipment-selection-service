/**
 * Назначение: Форма шага «Горячее водоснабжение».
 * Описание: Жильцы, температура ГВС, точки водоразбора; полный отчёт — в модалке.
 */

import { useState } from 'react';
import type { HotWaterFormValue } from '../../types/hotWater';
import type { ParsedHotWaterReport } from '../../types/hotWaterReport';
import { HotWaterReportDialog } from '../HotWaterReport/HotWaterReportDialog';
import { hasHotWaterReportContent } from '../HotWaterReport/hasHotWaterReportContent';
import { hasHotWaterFixturesContent } from '../../utils/countThermalFixtures';
import reportActionsStyles from '../SurveyNavigation/SurveyReportActions.module.css';
import styles from './HotWaterForm.module.css';

type Props = {
  value: HotWaterFormValue;
  onChange: (next: HotWaterFormValue) => void;
  hotWaterReport?: ParsedHotWaterReport | null;
  calcLoading?: boolean;
  /** Прокрутка к таблице точек в сайдбаре «Результаты». */
  onBackToResults?: () => void;
};

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function HotWaterForm({
  value,
  onChange,
  hotWaterReport = null,
  calcLoading = false,
  onBackToResults,
}: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const canOpenReport =
    hasHotWaterReportContent(hotWaterReport)
    || hasHotWaterFixturesContent(value.fixtures);

  const setResidents = (n: number) =>
    { onChange({ ...value, residents: clampInt(n, 0, 20) }); };

  const setTemp = (key: 'hotWaterC', n: number) =>
    { onChange({ ...value, [key]: n }); };

  const setFixture = (
    key: keyof HotWaterFormValue['fixtures'],
    n: number,
  ) =>
    { onChange({
      ...value,
      fixtures: {
        ...value.fixtures,
        [key]: clampInt(n, 0, 30),
      },
    }); };

  const f = value.fixtures;

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Гаряче водопостачання</h2>
      <p className={styles.hint}>
        Тип об&apos;єкта задається на кроці «Об&apos;єкт»: для{' '}
        <strong>квартири</strong> рахується проточний сценарій (потужність від пікової витрати); для{' '}
        <strong>будинку</strong> — накопичувальний (об&apos;єм бака без сумування добової норми з об&apos;ємом
        ванни; потужність для котла — від нагрівання бака за час, не від «проливу»).
      </p>

      <div className={styles.row}>
        <div className={`${styles.field} ${styles.checkboxRow}`}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={value.tropicalShower}
              onChange={(e) => { onChange({ ...value, tropicalShower: e.target.checked }); }}
            />
            <span>
              Посилений («тропічний») душ — збільшує розрахунковий об&apos;єм накопичувального /
              буферного бака на 30&nbsp;%
            </span>
          </label>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="hw-residents">
            Кількість осіб
          </label>
          <input
            id="hw-residents"
            className={styles.control}
            type="number"
            min={0}
            max={20}
            value={value.residents}
            onChange={(e) => { setResidents(Number(e.target.value)); }}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label} id="hw-cold-season-label">
            Розрахункова температура холодної води
          </span>
          <div className={styles.seasonChoice} role="group" aria-labelledby="hw-cold-season-label">
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="coldWaterDesignSeason"
                checked={value.coldWaterDesignSeason === 'winter'}
                onChange={() => { onChange({ ...value, coldWaterDesignSeason: 'winter' }); }}
              />
              Зима (+5&nbsp;°C)
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="coldWaterDesignSeason"
                checked={value.coldWaterDesignSeason === 'summer'}
                onChange={() => { onChange({ ...value, coldWaterDesignSeason: 'summer' }); }}
              />
              Літо (+15&nbsp;°C)
            </label>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="hw-hot">
            ГВ, °C (55…60)
          </label>
          <input
            id="hw-hot"
            className={styles.control}
            type="number"
            min={55}
            max={60}
            step={0.5}
            value={value.hotWaterC}
            onChange={(e) => { setTemp('hotWaterC', Number(e.target.value)); }}
          />
        </div>
      </div>

      <h3 className={styles.subheading}>Точки за приміщеннями</h3>

      <div className={styles.fixtureSection}>
        <h4 className={styles.fixtureSectionTitle}>Кухня</h4>
        <p className={styles.fixtureSectionHint}>
          Вкажіть, які точки водорозбору з гарячою водою є на кухні.
        </p>
        <div className={styles.fixturesGrid}>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-kitchen-sink">
              Мийка / змішувач
            </label>
            <input
              id="fx-kitchen-sink"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.kitchenSink}
              onChange={(e) => { setFixture('kitchenSink', Number(e.target.value)); }}
            />
          </div>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-dishwasher">
              Посудомийна машина
            </label>
            <input
              id="fx-dishwasher"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.dishwasher}
              onChange={(e) => { setFixture('dishwasher', Number(e.target.value)); }}
            />
          </div>
        </div>
      </div>

      <div className={styles.fixtureSection}>
        <h4 className={styles.fixtureSectionTitle}>Санітарний вузол</h4>
        <p className={styles.fixtureSectionHint}>
          Точки у ванній / суміщеному санвузлі (можна сумарно за всі санвузли об&apos;єкта).
        </p>
        <div className={styles.fixturesGrid}>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-shower">
              Душ
            </label>
            <input
              id="fx-shower"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.shower}
              onChange={(e) => { setFixture('shower', Number(e.target.value)); }}
            />
          </div>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-bath">
              Ванна
            </label>
            <input
              id="fx-bath"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.bath}
              onChange={(e) => { setFixture('bath', Number(e.target.value)); }}
            />
          </div>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-sink">
              Раковина
            </label>
            <input
              id="fx-sink"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.sink}
              onChange={(e) => { setFixture('sink', Number(e.target.value)); }}
            />
          </div>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-toilet">
              Унітаз
            </label>
            <input
              id="fx-toilet"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.toilet}
              onChange={(e) => { setFixture('toilet', Number(e.target.value)); }}
            />
          </div>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-bidet">
              Біде
            </label>
            <input
              id="fx-bidet"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.bidet}
              onChange={(e) => { setFixture('bidet', Number(e.target.value)); }}
            />
          </div>
        </div>
      </div>

      <div className={styles.fixtureSection}>
        <h4 className={styles.fixtureSectionTitle}>Госпблок / техприміщення / пральня</h4>
        <p className={styles.fixtureSectionHint}>
          Точки у підсобці, котельні, пральні тощо.
        </p>
        <div className={styles.fixturesGrid}>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-laundry">
              Мийка
            </label>
            <input
              id="fx-laundry"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.laundrySink}
              onChange={(e) => { setFixture('laundrySink', Number(e.target.value)); }}
            />
          </div>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-washer">
              Прална машина
            </label>
            <input
              id="fx-washer"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.washingMachine}
              onChange={(e) => { setFixture('washingMachine', Number(e.target.value)); }}
            />
          </div>
        </div>
      </div>

      <div className={reportActionsStyles.reportActions}>
        <div className={reportActionsStyles.reportActionsRow}>
          <button
            type="button"
            className={reportActionsStyles.reportButton}
            disabled={!canOpenReport}
            onClick={() => { setReportOpen(true); }}
          >
            Звіт з розрахунку ГВ
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
            Вкажіть точки водорозбору — звіт і таблиця в «Результатах» з&apos;являться
            одразу; розрахунок потужності — після авторозрахунку.
          </p>
        )}
      </div>

      <HotWaterReportDialog
        open={reportOpen}
        onClose={() => { setReportOpen(false); }}
        hotWater={hotWaterReport}
        formValue={value}
      />
    </div>
  );
}
